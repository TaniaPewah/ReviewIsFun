# Test the current checkpoint

## What is available

This checkpoint contains the design/architecture documents, a TypeScript review-engine prototype, a Git snapshot adapter, their tests, shared message types, extension scaffolding, and cosmic celebration artwork. The repository is **TaniaPewah/ReviewIsFun**; ReviewQuest is the extension's working name.

The React chat implementation and extension entry point do not exist yet. This checkpoint cannot be installed as a functioning Cursor/VS Code extension. The existing core is a historical prototype: for example, the approved single-follow-up limit has not been implemented. Passing its tests validates the prototype, not the completed product or every agreed design choice.

## Prerequisites

- Node.js **24 LTS** with npm. The pinned Vitest version supports Node 22.12+ or 24; Node 24 is the recommended development runtime for this checkpoint.
- Git on your PATH, including for the snapshot integration tests.
- No Codex login or API key is needed for these prototype tests.

## Clone, install, and validate

```bash
git clone https://github.com/TaniaPewah/ReviewIsFun.git
cd ReviewIsFun
npm ci --ignore-scripts
npm run typecheck
npm test
```

For an existing checkout, first preserve your own changes, then update its main branch using your normal Git workflow.

The frozen-lockfile install, TypeScript check, and tests were exercised in the cloud environment for this checkpoint. The expected test result is **2 test files and 37 tests passed**.

To focus on either area:

```bash
npm test -- tests/core.test.ts
npm test -- tests/git.test.ts
```

## What the checks exercise

- Review state transitions, explicit Continue, the existing prototype's score rules, duplicate point prevention, malformed assessment rejection, uncertain results, and saved-state validation.
- Temporary real Git repositories covering initial commits, regular commits, merges, renames, deletions, unusual filenames, binary/summarized files, and exact code excerpts.

The Git fixtures are created in temporary directories; they do not alter your application's repository.

## Extension testing comes later

The existing build, package, and F5 launch scaffolding references src/extension.ts and src/webview/main.tsx, which have not been implemented. An editor launch is therefore not a supported test of this checkpoint.

After the remaining engineering choices are settled and those components exist, validation will include building a VSIX, installing it in VS Code/Cursor, reviewing a real commit, and making a live Codex request. Those capabilities are currently unverified.

## Portable setup

Cloud-specific npm cache configuration, installed dependencies, generated output, and credential files are excluded from this checkpoint. Dependency declarations and the lockfile are included. Local installation uses your machine's normal npm configuration.
