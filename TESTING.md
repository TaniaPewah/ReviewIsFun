# Test the current checkpoint

## What is available

This checkpoint contains the design/architecture documents, a TypeScript review-engine prototype, a Git snapshot adapter, their tests, shared message types, extension scaffolding, and cosmic celebration artwork. The repository is **TaniaPewah/ReviewIsFun**; ReviewQuest is the extension's working name.

The React chat implementation and extension entry point do not exist yet. This checkpoint cannot be installed as a functioning Cursor/VS Code extension. The existing core is a historical prototype: for example, the approved single-follow-up limit has not been implemented. Passing its tests validates the prototype, not the completed product or every agreed design choice.

## Prerequisites

- Node.js **24 LTS** with npm for the tools. Agreed A23: this is the toolchain version. Extension code itself uses Node 20 APIs because the VS Code 1.95 host does.
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

## Required coverage and proposed local development workflow

The owner selected Vitest after comparing it with Jest and node:test. A21 and A22 are now agreed. The expanded capabilities are not implemented by the current checkpoint. Vitest remains test tooling, esbuild builds release bundles, and `tsc --noEmit` checks types separately. ESLint uses the type-checked TypeScript recommended set and React's official Hooks recommended set. Those packages have not been added yet.

Agreed modes:

1. **Offline automated scenarios:** TypeScript scenario modules supply editor events, user actions, model results, storage results, and clock ticks to the real controller through fake dependencies. A timeout advances the fake clock and does not call Codex. Tests do not replace private controller functions.
2. **Real Git fixtures:** temporary repositories cover initial/ordinary/merge commits, renames/deletions, generated/binary/lockfile changes, cosmetic-only changes, large commits, and choices spanning files. Notification tests follow A19: checkout, reset, and staging stay quiet; a commit, amend, merge, pull, or finished rebase notifies once.
3. **Interactive local scenarios:** the same modules feed a development-only `ReviewQuest: Run Scenario` command so the real React chat can step through events. The packaged extension does not register that command. Chat assertions in CI render in a test page. They do not launch VS Code or Cursor.
4. **Real decision-selection evaluations:** `npm run evaluate:selection` runs the actual pipeline on eight labelled fixtures. A person judges meaning, including different wording. Structural checks fail the run, including a highlight on a formatting-only commit. Recall must be at least 75%, with at most one unsupported highlight, on all three runs. The learner's 80% gate is not this pass mark.

CI runs `npm ci`, typecheck, lint, offline tests, build, and package. It does not call Codex and it does not publish. No such harness or evaluation was implemented or run during consultation.

Agreed AI output policy: require JSON Schema-constrained responses plus host runtime structure/application checks before use. Try Zod 4 for these response contracts, deriving TypeScript types, runtime validators, and JSON Schema from each definition. The validation test scope includes well-formed JSON with nonexistent files or out-of-range lines, references to the wrong before/after version, and assessment references to unknown prepared criteria. Invalid code references must prevent display of the highlight; displayed snippets come from the verified Git snapshot. Exact schemas, package pin, generated-schema compatibility checks, and recovery behavior remain pending. These checks establish structural/reference consistency, while the separate real-provider evaluations assess decision-selection quality. No Zod dependency or validator was added during consultation.

Agreed correction bound: an invalid original response permits one automatic correction request with validation errors, the same task/snapshot, and unchanged submitted answer/prepared criteria for assessment. Validate the replacement fully. Planned scenarios cover successful correction, a second invalid response stopping automatic requests and showing failure with manual Retry, preserved verified progress, no score/reward from rejected output, and unchanged learner-follow-up allowance. Exact wiring, error classification, manual-retry accounting, and other failure policies remain pending. This correction mechanism has not been implemented or run during consultation.

Agreed A9 access policy: use the same exclusions for initial context and every list/search/read result, including known credential/private-key defaults and additional editor-setting exclusions. Planned fixtures must include a committed excluded file whose contents match a search query, ensuring no excluded content is supplied to the AI; cover both fixed before/after versions and policy consistency across all context routes. Repository/answer text cannot broaden permissions. Provider/scope disclosure belongs in the review start message and excluded areas remain in local coverage records. Exact patterns/settings and blocked-result representation remain pending; filtering tests cannot establish that arbitrary permitted source contains no secrets. No access policy was implemented or tested during consultation.

Agreed A10 context/coverage policy: start with fixed IDs, a permitted file inventory, diffs and bounded surrounding code; preserve rename/deletion before/after references. Planned fixtures must cover chunking a large commit and consolidating the same decision across chunks/files into one highlight, with supplied/summarized/excluded/pending coverage recorded. Verify binary/generated visibility, meaningful dependency decisions supported by lockfiles, and pausing/reporting pending work when the overall budget is insufficient. Evaluate the complete context/selection/consolidation pipeline so chunk boundaries and omissions can affect measured identification quality. Exact chunk mechanics, excerpt sizes, schemas, and numerical context/total-work caps remain pending. No planner or chunk/consolidation pipeline was implemented or tested during consultation.

Agreed A11 selection/evidence policy: prioritize consequential code-backed choices with useful reasoning/credible alternatives or tradeoffs, merge the same underlying choice across chunks/files, retain distinct choices, and allow zero highlights without a forced quota. Labelled evaluation fixtures must include formatting-only/other routine cases with zero expected highlights, impactful decisions spanning files, and similar-looking but distinct decisions. Assess inferred versus evidenced rationale. Offline application scenarios must verify retaining the validated outline and presented highlight definitions/prepared criteria across resume/retry paths once their contracts are chosen. Mocked outputs establish application handling; real-provider cases assess actual selection quality. Exact prompts/schemas, semantic grouping/quality criteria, and explicit correction/versioning behavior remain pending. No selector, freezing mechanism, or evaluation was implemented/run during consultation.

Agreed A12–A14 model continuation: start with configurable GPT-6.1 Sol/Medium. A switch starts a new thread with the JSON checkpoint and discards a late result from the old model. Planned offline scenarios must exercise that discard, preserved scores and follow-up allowance, and a timeout that spends neither the validation correction nor the learner follow-up. Numerical context and total-work budgets remain pending. No handoff or live model request was run during consultation.

Agreed code-access boundary: the extension supplies code from the pinned commit/comparison base, with model-initiated general terminal execution and unrestricted workspace browsing disabled. The extension retains its programmed Git CLI reads. Allow bounded structured List paths, literal Search text, and Read lines requests; the extension validator checks requests/permitted scope and the Git/context reader retrieves approved code from the fixed versions. Planned fixtures must verify path discovery, search path/line results, and exact before/after range reads using host-resolved versions. Start with two additional context rounds per original AI operation; several files in one batch count as one round. Planned scenarios must cover batched retrieval, enforcement of the cap, pausing with preserved progress when necessary information is still missing, invalid/unpermitted requests, context stability when working files/HEAD change, and separate context/correction/learner-follow-up budgets. Numerical context-size limits remain pending. Agreed A13 and A23: the VS Code and Cursor installs must show that a permissive project Codex config and an unsupplied secrets file are not read or executed. No retrieval loop or runtime configuration was implemented or verified during consultation.

## Extension testing comes later

The existing build, package, and F5 launch scaffolding references src/extension.ts and src/webview/main.tsx, which have not been implemented. An editor launch is therefore not a supported test of this checkpoint.

The agreed delivery workflow is VSIX first (A23). When the extension exists, build the package with project-pinned `@vscode/vsce` and install that same file in VS Code `^1.95.0` and in Cursor. Each editor must activate, complete a real review, accept keyboard submit, honor reduced motion, and pass the isolation probe. Report the editors separately. Publish only after both pass. Ubuntu CI producing the VSIX does not replace those checks. Windows is unclaimed. These runtime capabilities are currently unverified.

## Portable setup

Cloud-specific npm cache configuration, installed dependencies, generated output, and credential files are excluded from this checkpoint. Dependency declarations and the lockfile are included. Local installation uses your machine's normal npm configuration.
