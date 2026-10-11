import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { getSnapshot, parsePatch, SnapshotError } from '../src/git/snapshot.js';

const exec = promisify(execFile);
const repositories: string[] = [];

async function git(repo: string, ...args: string[]): Promise<string> {
  return (await exec('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim();
}

async function repository(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), 'reviewquest-git-'));
  repositories.push(repo);
  await git(repo, 'init', '--initial-branch=main');
  await git(repo, 'config', 'user.email', 'fixtures@example.invalid');
  await git(repo, 'config', 'user.name', 'ReviewQuest fixture');
  await git(repo, 'config', 'commit.gpgsign', 'false');
  await git(repo, 'config', 'core.autocrlf', 'false');
  return repo;
}

async function commit(repo: string, message: string): Promise<string> {
  await git(repo, 'add', '--all');
  await git(repo, 'commit', '--quiet', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repo) => rm(repo, { recursive: true, force: true })));
});

describe('read-only Git snapshots', () => {
  it('reads an initial commit without creating or writing an empty-tree object', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'hello.ts'), 'export const hello = "world";\n');
    const sha = await commit(repo, 'Introduce greeting');
    const before = await git(repo, 'status', '--porcelain');
    const objectsBefore = await git(repo, 'count-objects', '-v');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.sha).toBe(sha);
    expect(snapshot.parentSha).toBeNull();
    expect(snapshot.message).toBe('Introduce greeting');
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0]).toMatchObject({ path: 'hello.ts', status: 'added', additions: 1, deletions: 0, binary: false, summaryOnly: false });
    expect(snapshot.files[0].hunks[0]).toMatchObject({ before: '', after: 'export const hello = "world";\n', oldStart: 0, newStart: 1 });
    expect(await git(repo, 'status', '--porcelain')).toBe(before);
    expect(await git(repo, 'count-objects', '-v')).toBe(objectsBefore);
  });

  it('pins HEAD and reads committed code rather than dirty working files', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'main.ts'), 'const value = 1;\n');
    const parentSha = await commit(repo, 'Start');
    await writeFile(join(repo, 'main.ts'), 'const value = 2;\n');
    const sha = await commit(repo, 'Increase value');
    await writeFile(join(repo, 'main.ts'), 'uncommitted content\n');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.parentSha).toBe(parentSha);
    expect(snapshot.sha).toBe(sha);
    expect(snapshot.files[0].hunks[0]).toMatchObject({ before: 'const value = 1;\n', after: 'const value = 2;\n', oldStart: 1, newStart: 1 });
    await writeFile(join(repo, 'main.ts'), 'const value = 3;\n');
    await commit(repo, 'Increase again');
    expect(snapshot.sha).toBe(sha);
    expect((await getSnapshot(repo, sha)).files[0].hunks).toEqual(snapshot.files[0].hunks);
  });

  it('retains renamed paths, deleted code and literal unusual filenames', async () => {
    const repo = await repository();
    const unusual = '- odd\tfile\n[star]*:name.ts';
    await writeFile(join(repo, 'before.ts'), Array.from({ length: 12 }, (_, n) => `line ${n}`).join('\n') + '\n');
    await writeFile(join(repo, 'removed.ts'), 'deleted code\n');
    await writeFile(join(repo, unusual), 'old unusual code\n');
    await commit(repo, 'Start');
    await git(repo, 'mv', 'before.ts', 'after.ts');
    await writeFile(join(repo, 'after.ts'), 'new line\n' + Array.from({ length: 12 }, (_, n) => `line ${n}`).join('\n') + '\n');
    await rm(join(repo, 'removed.ts'));
    await writeFile(join(repo, unusual), 'new unusual code\n');
    await commit(repo, 'Rename delete and change');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.files.find((file) => file.path === 'after.ts')).toMatchObject({ status: 'renamed', oldPath: 'before.ts', summaryOnly: false });
    expect(snapshot.files.find((file) => file.path === 'after.ts')?.hunks[0].after).toContain('new line\n');
    expect(snapshot.files.find((file) => file.path === 'removed.ts')?.hunks[0]).toMatchObject({ before: 'deleted code\n', after: '', newStart: 0 });
    expect(snapshot.files.find((file) => file.path === unusual)?.hunks[0]).toMatchObject({ before: 'old unusual code\n', after: 'new unusual code\n' });
  });

  it('does not mix a renamed file with a new file at its former path', async () => {
    const repo = await repository();
    const original = Array.from({ length: 25 }, (_, n) => `original ${n}`).join('\n') + '\n';
    await writeFile(join(repo, 'source.ts'), original);
    await commit(repo, 'Start');
    await git(repo, 'mv', 'source.ts', 'destination.ts');
    await writeFile(join(repo, 'destination.ts'), original + 'extra line\n');
    await writeFile(join(repo, 'source.ts'), 'unrelated replacement\n');
    await commit(repo, 'Move source and replace');
    const snapshot = await getSnapshot(repo);
    const renamed = snapshot.files.find((file) => file.path === 'destination.ts');
    // Since source.ts still exists, Git reports this as a copy of its former
    // content. Both copy and rename need an isolated before/after blob diff.
    expect(renamed?.status).toBe('copied');
    expect(renamed?.hunks.map((hunk) => hunk.after).join('')).toContain('extra line');
    expect(renamed?.hunks.map((hunk) => hunk.after).join('')).not.toContain('unrelated replacement');
  });

  it('keeps binary, lockfiles, generated content and sensitive paths visible as summaries', async () => {
    const repo = await repository();
    await mkdir(join(repo, 'dist'));
    await writeFile(join(repo, 'photo.bin'), Buffer.from([0, 1, 2, 255]));
    await writeFile(join(repo, 'package-lock.json'), '{"lockfileVersion": 3}\n');
    await writeFile(join(repo, 'dist/bundle.js'), 'generated();\n');
    await writeFile(join(repo, '.env'), 'API_KEY=fixture-not-a-real-secret\n');
    await writeFile(join(repo, '.env.example'), 'API_KEY=\n');
    await commit(repo, 'Add assorted files');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.files).toHaveLength(5);
    expect(snapshot.files.find((file) => file.path === 'photo.bin')).toMatchObject({ binary: true, summaryOnly: true, additions: null, deletions: null });
    for (const path of ['photo.bin', 'package-lock.json', 'dist/bundle.js', '.env']) {
      expect(snapshot.files.find((file) => file.path === path)).toMatchObject({ summaryOnly: true, patch: '', hunks: [], patchTruncated: false });
      expect(snapshot.files.find((file) => file.path === path)?.summaryReason).toBeTruthy();
    }
    expect(snapshot.files.find((file) => file.path === '.env.example')?.summaryOnly).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('fixture-not-a-real-secret');
  });

  it('explicitly compares merge commits against the first parent', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'base.ts'), 'base\n');
    await commit(repo, 'Base');
    await git(repo, 'switch', '-c', 'feature');
    await writeFile(join(repo, 'feature.ts'), 'feature\n');
    await commit(repo, 'Feature');
    await git(repo, 'switch', 'main');
    await writeFile(join(repo, 'main.ts'), 'main\n');
    const firstParent = await commit(repo, 'Main change');
    await git(repo, 'merge', '--no-ff', '-m', 'Merge feature', 'feature');
    const snapshot = await getSnapshot(repo);
    expect(snapshot).toMatchObject({ parentSha: firstParent, isMerge: true, parentCount: 2 });
    expect(snapshot.files.map((file) => file.path)).toEqual(['feature.ts']);
    expect(snapshot.warnings.join(' ')).toContain('first parent');
  });

  it('shows at most 20 changed lines in a preview while retaining every complete hunk', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'large.ts'), Array.from({ length: 60 }, (_, n) => `const line${n} = ${n};`).join('\n') + '\n');
    await commit(repo, 'Large initial change');
    const snapshot = await getSnapshot(repo);
    const hunk = snapshot.files[0].hunks[0];
    expect(hunk.changedLines).toBe(60);
    expect(hunk.preview.changedLines).toBe(20);
    expect(hunk.preview.remainingChangedLines).toBe(40);
    expect(hunk.after).toContain('const line59 = 59;');
    expect(hunk.preview.after).not.toContain('const line59 = 59;');
    expect(snapshot.files[0].patchTruncated).toBe(false);
  });

  it('reports code coverage as incomplete for an oversized textual patch', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'huge.txt'), 'x'.repeat(4 * 1024 * 1024 + 200) + '\n');
    await commit(repo, 'Too large for a code lesson');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.files[0]).toMatchObject({ summaryOnly: true, patchTruncated: true, patch: '', hunks: [] });
    expect(snapshot.files[0].summaryReason).toContain('4 MiB');
    expect(snapshot.warnings.join(' ')).toContain('incomplete');
  });

  it('does not run configured external diff or text conversion commands', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'main.ts'), 'one\n');
    await writeFile(join(repo, '.gitattributes'), '*.ts diff=fixture\n');
    await commit(repo, 'Base');
    await writeFile(join(repo, 'main.ts'), 'two\n');
    await commit(repo, 'Change');
    await git(repo, 'config', 'diff.external', 'this-command-must-never-run');
    await git(repo, 'config', 'diff.fixture.textconv', 'this-other-command-must-never-run');
    const snapshot = await getSnapshot(repo);
    expect(snapshot.files[0].hunks[0].after).toBe('two\n');
    expect(snapshot.warnings).toEqual([]);
  });

  it('rejects option-like revisions and non-commit objects without modifying the repo', async () => {
    const repo = await repository();
    await writeFile(join(repo, 'main.ts'), 'code\n');
    await commit(repo, 'Base');
    await expect(getSnapshot(repo, '--output=malicious')).rejects.toMatchObject({ kind: 'invalid-revision' });
    const blob = await git(repo, 'rev-parse', 'HEAD:main.ts');
    await expect(getSnapshot(repo, blob)).rejects.toBeInstanceOf(SnapshotError);
    expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('code\n');
    expect(await git(repo, 'status', '--porcelain')).toBe('');
  });
});

describe('unified patch parsing', () => {
  it('preserves CRLF and the absence of a final newline on each side', () => {
    const hunks = parsePatch('diff --git a/file b/file\n--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context\r\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n');
    expect(hunks[0]).toMatchObject({ before: 'context\r\nold', after: 'context\r\nnew', oldStart: 1, newStart: 1 });
  });

  it('retains multiple hunks and rejects incomplete patches', () => {
    const hunks = parsePatch('@@ -1 +1 @@\n-old\n+new\n@@ -30 +30 @@\n-before\n+after\n');
    expect(hunks).toHaveLength(2);
    expect(hunks[1]).toMatchObject({ oldStart: 30, newStart: 30, before: 'before\n', after: 'after\n' });
    expect(() => parsePatch('@@ -1,2 +1 @@\n-old\n+new\n')).toThrow('Incomplete');
  });
});
