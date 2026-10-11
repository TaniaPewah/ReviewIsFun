import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_PATCH_BYTES = 4 * 1024 * 1024;
const MAX_METADATA_BYTES = 16 * 1024 * 1024;
const PREVIEW_CHANGED_LINES = 20;

export type ChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechanged'
  | 'unmerged'
  | 'unknown';

export interface HunkPreview {
  before: string;
  after: string;
  oldStart: number;
  newStart: number;
  changedLines: number;
  remainingChangedLines: number;
}

export interface Hunk {
  before: string;
  after: string;
  oldStart: number;
  newStart: number;
  oldCount: number;
  newCount: number;
  changedLines: number;
  /** Small first view. The full hunk remains available above. */
  preview: HunkPreview;
}

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: ChangeStatus;
  patch: string;
  binary: boolean;
  summaryOnly: boolean;
  summaryReason?: string;
  /** A failed size-limited read is never presented as complete coverage. */
  patchTruncated: boolean;
  additions: number | null;
  deletions: number | null;
  hunks: Hunk[];
}

export interface CommitSnapshot {
  repoPath: string;
  sha: string;
  parentSha: string | null;
  message: string;
  files: ChangedFile[];
  isMerge: boolean;
  parentCount: number;
  warnings: string[];
}

export class SnapshotError extends Error {
  constructor(
    message: string,
    public readonly kind: 'not-repository' | 'invalid-revision' | 'git-unavailable' | 'git-failed',
  ) {
    super(message);
    this.name = 'SnapshotError';
  }
}

interface GitError extends Error {
  code?: string | number;
  stderr?: string;
}

async function git(repoPath: string, args: string[], maxBuffer = MAX_METADATA_BYTES): Promise<string> {
  const result = await execFileAsync(
    'git',
    ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'color.ui=false', ...args],
    {
      cwd: repoPath,
      encoding: 'utf8',
      maxBuffer,
      timeout: 30_000,
      shell: false,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
    },
  );
  return result.stdout;
}

function removeOutputNewline(value: string): string {
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

/**
 * Uses object IDs throughout; changing HEAD or the working tree cannot change a
 * returned session. No shell, external diff driver, text conversion, or write
 * operation is used. Initial commits use diff-tree --root (no empty-tree write).
 */
export async function getSnapshot(repoPath: string, revision = 'HEAD'): Promise<CommitSnapshot> {
  let root: string;
  try {
    root = removeOutputNewline(await git(repoPath, ['rev-parse', '--show-toplevel']));
  } catch (error) {
    const failure = error as GitError;
    throw new SnapshotError(
      failure.code === 'ENOENT' ? 'Git is not available.' : 'Select a directory inside a Git working tree.',
      failure.code === 'ENOENT' ? 'git-unavailable' : 'not-repository',
    );
  }

  let sha: string;
  try {
    // --end-of-options prevents even a revision starting with "--" from
    // becoming an option. ^{commit} rejects blobs and trees; tags may resolve.
    sha = (await git(root, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`])).trim();
    if (!SHA_PATTERN.test(sha)) throw new Error('Invalid object ID');
  } catch {
    throw new SnapshotError('The selected revision does not resolve to a commit.', 'invalid-revision');
  }

  try {
    const parentsOutput = await git(root, ['rev-list', '--parents', '-n', '1', sha, '--']);
    const [resolvedSha, ...parents] = parentsOutput.trim().split(' ');
    if (resolvedSha !== sha || parents.some((parent) => !SHA_PATTERN.test(parent))) {
      throw new Error('Git returned an invalid commit ancestry.');
    }
    const parentSha = parents[0] ?? null;
    const commonArgs = [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '-r',
      '--find-renames',
      '--find-copies',
      '--no-ext-diff',
      '--no-textconv',
    ];
    const comparison = parentSha ? [parentSha, sha] : [sha];
    const [message, statuses, stats] = await Promise.all([
      git(root, ['log', '-1', '--format=%B', sha, '--']),
      git(root, [...commonArgs, '--name-status', '-z', ...comparison, '--']),
      git(root, [...commonArgs, '--numstat', '-z', ...comparison, '--']),
    ]);
    const fileStats = parseNumstat(stats);
    const files = parseNameStatus(statuses).map((file) => ({
      ...file,
      ...(fileStats.get(file.path) ?? { binary: false, additions: null, deletions: null }),
    }));
    const warnings: string[] = [];
    if (parents.length > 1) {
      warnings.push('Merge commit: this review compares the commit against its first parent only.');
    }

    // Bound process concurrency even for commits containing thousands of files.
    const changedFiles: ChangedFile[] = new Array(files.length);
    let nextFile = 0;
    const worker = async (): Promise<void> => {
      while (nextFile < files.length) {
        const index = nextFile++;
        const file = files[index];
        const summaryReason = getSummaryReason(file.path, file.binary);
        if (summaryReason) {
          changedFiles[index] = { ...file, patch: '', hunks: [], summaryOnly: true, summaryReason, patchTruncated: false };
          continue;
        }
        try {
          const paths = file.oldPath ? [file.oldPath, file.path] : [file.path];
          // A rename/copy source can also be changed or recreated in the same
          // commit. Filtering by both paths would include that other file's
          // hunks, so compare the two committed blobs directly in this case.
          let patchArgs: string[];
          if (file.oldPath && parentSha) {
            const [beforeBlob, afterBlob] = await Promise.all([
              git(root, ['rev-parse', '--verify', '--end-of-options', `${parentSha}:${file.oldPath}`]),
              git(root, ['rev-parse', '--verify', '--end-of-options', `${sha}:${file.path}`]),
            ]);
            const beforeId = beforeBlob.trim();
            const afterId = afterBlob.trim();
            if (!SHA_PATTERN.test(beforeId) || !SHA_PATTERN.test(afterId)) throw new Error('Invalid Git blob ID.');
            patchArgs = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--unified=3', '--inter-hunk-context=0', '--diff-algorithm=myers', beforeId, afterId, '--'];
          } else {
            patchArgs = [
              ...commonArgs,
              '--patch',
              '--no-color',
              '--unified=3',
              '--inter-hunk-context=0',
              '--diff-algorithm=myers',
              ...comparison,
              '--',
              ...paths.map((path) => `:(literal)${path}`),
            ];
          }
          const patch = await git(
            root,
            patchArgs,
            MAX_PATCH_BYTES,
          );
          const hunks = parsePatch(patch);
          changedFiles[index] = {
            ...file,
            patch,
            hunks,
            summaryOnly: hunks.length === 0,
            ...(hunks.length === 0 ? { summaryReason: 'Metadata-only change: there are no textual code hunks.' } : {}),
            patchTruncated: false,
          };
        } catch (error) {
          const failure = error as GitError;
          const tooLarge = failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
          const reason = tooLarge
            ? 'The patch exceeds the 4 MiB review limit. Its code hunks are not covered; open the full Git diff to review them.'
            : 'Git could not read this patch. Its code hunks are not covered; retry or open the full Git diff.';
          changedFiles[index] = { ...file, patch: '', hunks: [], summaryOnly: true, summaryReason: reason, patchTruncated: true };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
    const incomplete = changedFiles.filter((file) => file.patchTruncated).length;
    if (incomplete > 0) warnings.push(`${incomplete} file patch(es) could not be loaded; code coverage is incomplete.`);
    return {
      repoPath: root,
      sha,
      parentSha,
      message: message.trimEnd(),
      files: changedFiles,
      isMerge: parents.length > 1,
      parentCount: parents.length,
      warnings,
    };
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError('Git could not read the selected commit snapshot.', 'git-failed');
  }
}

interface FileIdentity {
  path: string;
  oldPath?: string;
  status: ChangeStatus;
}

function parseNameStatus(output: string): FileIdentity[] {
  const tokens = output.split('\0');
  const files: FileIdentity[] = [];
  let index = 0;
  const statuses: Record<string, ChangeStatus> = {
    A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'typechanged', U: 'unmerged',
  };
  while (index < tokens.length && tokens[index]) {
    const code = tokens[index++][0];
    const firstPath = tokens[index++];
    if (!firstPath) throw new Error('Invalid Git name-status record.');
    if (code === 'R' || code === 'C') {
      const path = tokens[index++];
      if (!path) throw new Error('Invalid Git rename record.');
      files.push({ path, oldPath: firstPath, status: statuses[code] });
    } else {
      files.push({ path: firstPath, status: statuses[code] ?? 'unknown' });
    }
  }
  return files;
}

function parseNumstat(output: string): Map<string, { binary: boolean; additions: number | null; deletions: number | null }> {
  const records = output.split('\0');
  const result = new Map<string, { binary: boolean; additions: number | null; deletions: number | null }>();
  let index = 0;
  while (index < records.length && records[index]) {
    const record = records[index++];
    const firstTab = record.indexOf('\t');
    const secondTab = record.indexOf('\t', firstTab + 1);
    if (firstTab < 0 || secondTab < 0) throw new Error('Invalid Git numstat record.');
    const additions = record.slice(0, firstTab);
    const deletions = record.slice(firstTab + 1, secondTab);
    let path = record.slice(secondTab + 1);
    if (path === '') {
      // Renames/copies are encoded as counts + NUL + old path + NUL + new path.
      index++;
      path = records[index++];
      if (!path) throw new Error('Invalid Git numstat rename record.');
    }
    const binary = additions === '-' || deletions === '-';
    result.set(path, {
      binary,
      additions: binary ? null : Number(additions),
      deletions: binary ? null : Number(deletions),
    });
  }
  return result;
}

function getSummaryReason(path: string, binary: boolean): string | undefined {
  const basename = path.split('/').at(-1) ?? path;
  if (
    (/^\.env(?:\.|$)/i.test(basename) && !/^\.env\.(?:example|sample|template)$/i.test(basename)) ||
    /\.(?:pem|key|p12|pfx)$/i.test(basename) ||
    /^(?:\.npmrc|\.pypirc|credentials|id_rsa|id_ed25519)$/i.test(basename)
  ) return 'Potential credential file: excluded from code excerpts and AI context.';
  if (binary) return 'Binary content: summarized without textual code excerpts.';
  if (/^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|packages\.lock\.json|go\.sum)$/i.test(basename)) {
    return 'Dependency lock/checksum file: summarized rather than used as a code lesson.';
  }
  if (/(?:^|\/)(?:dist|build|coverage|node_modules|vendor|__generated__|generated)(?:\/|$)/i.test(path) || /\.(?:min\.js|map)$/i.test(basename)) {
    return 'Likely generated output (path heuristic): summarized rather than used as a code lesson.';
  }
  return undefined;
}

interface DiffLine {
  kind: 'context' | 'addition' | 'deletion';
  text: string;
  noNewline: boolean;
}

function renderSide(lines: DiffLine[], side: 'before' | 'after'): string {
  return lines
    .filter((line) => line.kind !== (side === 'before' ? 'addition' : 'deletion'))
    .map((line) => line.text + (line.noNewline ? '' : '\n'))
    .join('');
}

function makeHunk(lines: DiffLine[], oldStart: number, newStart: number, oldCount: number, newCount: number): Hunk {
  const changedLines = lines.filter((line) => line.kind !== 'context').length;
  let usedChanges = 0;
  let cutoff = 0;
  for (const line of lines) {
    if (line.kind !== 'context') {
      if (usedChanges === PREVIEW_CHANGED_LINES) break;
      usedChanges++;
    }
    cutoff++;
  }
  const previewLines = lines.slice(0, cutoff);
  return {
    before: renderSide(lines, 'before'),
    after: renderSide(lines, 'after'),
    oldStart,
    newStart,
    oldCount,
    newCount,
    changedLines,
    preview: {
      before: renderSide(previewLines, 'before'),
      after: renderSide(previewLines, 'after'),
      oldStart,
      newStart,
      changedLines: usedChanges,
      remainingChangedLines: changedLines - usedChanges,
    },
  };
}

/** Parse unified hunks, preserving code prefixes, CRLF and no-final-newline data. */
export function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: { oldStart: number; newStart: number; oldCount: number; newCount: number; lines: DiffLine[] } | undefined;
  let oldRead = 0;
  let newRead = 0;
  const finish = (): void => {
    if (!current) return;
    if (oldRead !== current.oldCount || newRead !== current.newCount) {
      throw new Error('Incomplete Git diff hunk.');
    }
    hunks.push(makeHunk(current.lines, current.oldStart, current.newStart, current.oldCount, current.newCount));
    current = undefined;
  };
  const content = patch.endsWith('\n') ? patch.slice(0, -1) : patch;
  for (const line of content.split('\n')) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      finish();
      current = { oldStart: Number(header[1]), oldCount: Number(header[2] ?? 1), newStart: Number(header[3]), newCount: Number(header[4] ?? 1), lines: [] };
      oldRead = 0;
      newRead = 0;
      continue;
    }
    if (!current) continue;
    if (line === '\\ No newline at end of file') {
      const previous = current.lines.at(-1);
      if (previous) previous.noNewline = true;
      continue;
    }
    // A new file header is outside a completed hunk, even when its path starts
    // with '+' or '-'. Remaining hunk counts disambiguate actual code lines.
    if (oldRead === current.oldCount && newRead === current.newCount) {
      finish();
      continue;
    }
    if (line.startsWith(' ')) {
      current.lines.push({ kind: 'context', text: line.slice(1), noNewline: false });
      oldRead++;
      newRead++;
    } else if (line.startsWith('-')) {
      current.lines.push({ kind: 'deletion', text: line.slice(1), noNewline: false });
      oldRead++;
    } else if (line.startsWith('+')) {
      current.lines.push({ kind: 'addition', text: line.slice(1), noNewline: false });
      newRead++;
    } else {
      throw new Error('Unexpected line inside a Git diff hunk.');
    }
  }
  finish();
  return hunks;
}
