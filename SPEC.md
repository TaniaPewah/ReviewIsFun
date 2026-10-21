# Product specification — proposed MVP

Agreed: notify after a real new commit and let the owner press Start; organize the walkthrough as one technical decision per guided review highlight; ask a short free-text reviewer question; score it with the host-owned rubric in A16; stay for one follow-up; Skip only after that follow-up is still under 80%. A13–A23 record the engineering choices. Exclusion patterns, excerpt sizes, prompt wording, and numerical context budgets remain open.

## Goal

Make reviewing a commit feel like reviewing code together in a custom React chat view beside code: short actual code snippets, manageable explanations, explicit understanding checks, useful alternatives, and joyful rewards. Review highlights are selected major technical decisions from the commit; every diff or changed file is not inherently a highlight. Start and recap belong to the same conversation rather than separate pages. Select the commit's major decisions first, then generate highlights on demand.

## Essential experience

1. Notify once when the CLI shows the worktree tip moved by a commit, amend, merge, pull, or finished rebase (agreed A19). Checkout, reset, and staging stay quiet. The notification names that verified commit. The model starts only after explicit Start. An open review stays on its pinned commit.
2. Pin the selected full commit ID and comparison base throughout the session (agreed): use its sole direct parent for a single-parent commit, its recorded first parent for a merge, and an empty tree for a parentless root commit. Subsequent commits, branch switches, and working-file edits do not change the active review. Presenting its message, comparison base, changed files, and an approximate number of review highlights remains proposed.
3. Agreed A11 selection policy: select consequential technical choices supported by specific code and useful reasoning/credible alternatives or tradeoffs. Consider behavior, architecture, data flow, reliability, security, performance, dependencies, and maintainability. Group by the underlying choice across files/chunks, merge duplicates, and keep distinct decisions separate. Do not force a quota: zero highlights are valid when no major decisions are identified, including formatting-only commits when appropriate. Retain the validated outline, generate each highlight on demand, and preserve its presented definition/prepared criteria within the session. Present short real before/after excerpts with paths and line references. Exact prompts/schemas, semantic grouping mechanics, quality thresholds, excerpt limits, and explicit correction/versioning behavior remain pending.
4. Agreed evidence policy: explain observed behavior, why the approach may be useful, and relevant alternatives/tradeoffs. Identify inferred rationale as inference; attribute author rationale only when supplied by commit messages, comments, or documents.
5. Ask a short free-text reviewer question about the highlighted decision, then stop and wait for the answer. Example review prompts include explaining behavior, predicting an outcome, or comparing alternatives.
6. Agreed A16: freeze 2–4 criteria before the answer. Weights are multiples of 10, from 20 through 50, summing to 100, with behavior and tradeoff each at least 30. The learner sees the question first; the rubric appears in the feedback. The model marks each criterion missed, partial, or met. The host awards 0, half, or all of that weight and ignores a model-supplied percent. Accept equivalent phrasing and sound alternatives. A confident host score of at least 80% unlocks explicit Continue. Uncertainty does not change the score and uses the one follow-up when it is still available. Across the two answers, keep the stronger finding per criterion. There is no extra challenge action.
7. Agreed A18: XP equals the host percent. Only the increase is stored. When a submission newly reaches at least 80%, play the bundled celebration inside the chat, with specific praise. A score that rises but stays under 80% shows the new percent and added XP without that celebration. Motion follows the editor unless overridden. Sound stays off unless enabled.
8. Stop again. Only an explicit **Continue** action starts the next highlight once the confident host score is at least 80%. There is at most one follow-up per highlight. Agreed A17: if the follow-up is still under 80% or still uncertain, the highlight is unresolved, Continue stays off, and there is no second follow-up. **Skip** records it unresolved and shows the next decision. **Close** leaves the session on that highlight for resume.
9. Post the recap in the same chat conversation: host percent, XP, skipped highlights, and an honest account of inspected or excluded changes. Do not equate passing selected questions with understanding every change.

## Points and verification

Agreed maximum: 100 XP per highlight, equal to the host percent. The rubric is the A16 weight rules, not a fixed 50/30/20 split. Show the rubric in the feedback. Credit sound alternative approaches and equivalent phrasing.

The follow-up earns only the increase. A lower later finding does not remove XP already stored for a criterion. Uncertain assessments and Skip add no XP. Invalid model output adds no XP. The host calculates XP from the validated findings. A model cannot choose XP or unlock Continue.

If assessment is uncertain, ask the one follow-up when it remains and explain the uncertainty. That follow-up is the reassessment. Do not grade by keywords alone or claim mathematical certainty about free-text understanding.

## Commit coverage

- Agreed: pin the selected full commit ID for the whole review session.
- Agreed comparison baseline: compare the selected commit against its direct parent using fixed IDs. A single-parent commit uses that sole parent, subject to the agreed merge/root rules below.
- Agreed initial-commit handling: compare the parentless root commit against an empty tree, treating its files as additions. This is the root-only exception to the direct-parent rule.
- Agreed merge handling: compare against the merge's recorded first parent. This is the receiving branch's pre-merge tip for a normal merge. Displaying the selected comparison explicitly remains proposed; deeper parent analysis is outside the selected first-parent comparison.
- Agreed A10 initial context: fixed commit/base IDs, a permitted changed-file inventory, textual diffs, and bounded surrounding code. Exact excerpt sizes remain pending.
- Agreed rename/deletion references: retain appropriate before/after paths and line references from the fixed versions.
- Agreed binary/generated/lockfile handling: retain binary/generated changes in the coverage inventory and explain what information was supplied or summarized. Lockfile changes remain eligible evidence for meaningful dependency decisions; do not automatically reduce them all to summary-only treatment.
- Agreed large-commit policy: analyze manageable chunks from the same snapshot, consolidate related/duplicate candidate decisions before presenting the outline, and merge the same underlying decision into one highlight. Track supplied/summarized/excluded/pending coverage. Planned chunks and additional context must fit the total analysis budget; pause and report remaining work if insufficient. Exact chunk mechanics and numerical size/total-work caps remain pending.
- Every commit is eligible for its own session. A19 notifies for a new tip commit and waits for Start. An explicit new review of the same commit does not delete the saved session.

## Visual rewards

Use the bundled cosmic celebration images inside the chat. The pass celebration plays when XP newly reaches at least 80%. It does not cover the code, and it does not call an image generator.

Motion follows the editor setting unless the extension setting says reduce or allow. Reduced motion shows a still image and the score text. Sound stays off unless enabled. Enter in the answer box submits the answer. Continue and Skip are buttons. A screen reader receives the score as text. Color is not the only pass/fail signal.

## Data and boundaries

Agreed A20: save each review as versioned JSON in editor workspace storage. The repository key is a hash of the Git common directory. The session adds the full commit id. Opening the same repository on another computer does not transfer progress. Saves are atomic. Older schema versions migrate without changing earned XP. A newer unknown version is left untouched. Completed sessions prune beyond the latest 30 per repository. In-progress sessions, including an unresolved highlight, are kept and resume where they stopped. Accounts, leaderboards, and cloud storage are not selected.

Agreed A9 policy: source code may be sent to the configured AI provider. Use one shared extension-enforced policy for initial context, List paths, Search text, and Read lines, restricted to the fixed review versions. Exclude known credential/private-key paths by default and support additional exclusions through editor settings. Excluded content must not reach the AI through search matches or any other context route. Show the configured provider and permitted scope in the review start message; subsequent permitted context requests use that scope automatically. Keep honest local records of excluded coverage. This is best-effort filtering, not a promise that arbitrary code is free of secrets. Exact patterns, settings details, and blocked-result representation remain pending.

Repository text and learner answers are untrusted data. They cannot instruct the extension to execute commands, edit source code, change the rubric, reveal credentials, or bypass progression. Review is read-only.

Agreed review code-access boundary: the extension supplies committed-code context from the pinned commit/comparison base, with model-initiated general terminal execution and unrestricted workspace browsing disabled for review requests. The extension still runs its programmed Git CLI reads. Allow bounded structured List paths, literal Search text, and Read lines requests: the extension validator checks structure/permitted scope and the Git/context reader retrieves approved code from the fixed review versions. The host resolves before/after versions from those fixed IDs. Start with two additional context rounds per original AI operation, counting several files requested together as one round. If necessary information remains missing at the cap, pause with a clear explanation and preserve existing progress. Context retrieval has a separate budget from automatic invalid-output correction and learner follow-ups. Tune the starting default through identification evaluations. Agreed A13: review runs ignore user and project Codex config, use a neutral directory, and pause if the read-only limits are not in effect. Excerpt sizes, permitted-path details, and numerical context caps remain pending.

Agreed A12–A14 model continuation: start with configurable GPT-6.1 Sol (`gpt-6.1-sol`)/Medium reasoning shared across the three AI operations, subject to verified availability. Record model/effort/prompt versions. If the chosen model is unavailable, pause and prompt for an optional replacement. Continue on a new thread with the application JSON. Discard a late result from the old model. Preserve the fixed snapshot, outline, criteria, answers, scores, XP, privacy scope, pending operation, and relevant counters. A model change does not reset the learner follow-up. Review runs use the isolated Codex client from A13. Numerical context and total-work budgets remain pending.

## First-version acceptance criteria

- A known test commit produces review highlights organized around technical decisions, with excerpts that match committed files and line references.
- Required verification scope, agreed A21: eight labelled fixtures judged by a person. A formatting-only commit must produce no highlight. Different wording can match the same decision. Recall must be at least 75%, with at most one unsupported highlight, on three real runs. This is not the learner's 80% gate, and a mocked selection does not pass it.
- Required local development capability, agreed A22: TypeScript scenarios drive the real controller with a fake model, clock, and store, and Git classification uses temporary real repositories. `npm test` does not call Codex.
- Agreed AI boundary: decision identification, highlight generation, and answer assessment use a small application-specific interface. Offline scenarios supply a fake implementation to the actual review controller; real identification evaluations use its production Codex SDK implementation. Exact method signatures remain pending.
- Agreed AI output validation: use JSON Schema-constrained responses and runtime structure/application checks in the host. Verify code references against the pinned commit/comparison base and assessment references against prepared criteria; read displayed snippets from the Git snapshot. Reject invalid references before displaying a highlight. Try Zod 4 for these response contracts, deriving TypeScript types, runtime validation, and JSON Schema from each definition. Exact schemas, package pin, generated-schema compatibility, and recovery details remain pending. Passing validation alone does not establish explanation or decision-selection quality.
- Agreed invalid-output recovery: one automatic correction request with validation errors and the unchanged task/snapshot, then full revalidation. Preserve verified progress and, for assessment, the submitted answer and prepared criteria. If the correction remains invalid, stop automatic requests and surface failure with manual Retry. Rejected output produces no score/reward; correction does not consume the learner-facing follow-up. Exact error classification, wiring, manual-retry accounting, and other failure handling remain pending.
- Before an answer and after feedback, no automatic transition reveals the next review highlight.
- Correct, partial, alternative, uncertain, and off-topic answers produce distinct, useful outcomes.
- Duplicate submissions do not duplicate points. A better follow-up awards only the increase, and the host keeps the stronger finding per criterion.
- Reloading resumes the same commit, review highlight, feedback, and XP.
- A changing `HEAD` does not change an active session.
- Initial commits, deletions, renames, and first-parent merge comparisons are handled or explicitly reported unsupported before a session starts.
- Generated and binary changes remain visible in the coverage map.
- Failed model calls preserve progress and allow retry without duplicate XP.
- Keyboard-only and reduced-motion flows work.
- Use npm and a committed authoritative `package-lock.json`, with `npm ci` for clean/CI installations. Direct dependencies are exact pins (agreed A23). Node 24 runs the tools. Extension code uses Node 20 APIs.
- Build, separate TypeScript compiler type checking (`tsc --noEmit`), linting, unit tests, and Git-fixture integration checks pass. esbuild bundles both runtime targets. ESLint uses the type-checked TypeScript recommended set and React's official Hooks recommended set. CI also packages the VSIX and does not call Codex.
- Agreed delivery: create a VSIX with project-pinned `@vscode/vsce`, then install that same file in VS Code `^1.95.0` and in Cursor. Each editor must activate, complete a real review, accept keyboard submit, honor reduced motion, and pass the isolation probe. Report the editors separately. Publish only after both pass. Windows is unclaimed.

## Proposed delivery order

1. Agree on platform, repository identity, and AI access approach.
2. Implement the small-step panel and deterministic progression/XP engine using labelled fixtures. Fixture mode is a UI development tool, not validation of real AI assessment.
3. Add actual Git snapshots, diff excerpts, and coverage tracking.
4. Add grounded decision grouping and review-highlight generation, plus the agreed understanding-check mechanism.
5. Add custom celebration artwork, accessibility, persistence, and error recovery.
6. Package the extension as a VSIX and install that same artifact in VS Code and Cursor. Marketplace release follows both passes, including the isolation probe (agreed A23).

Later: difficulty settings, spaced repetition, review history/backlog, richer merge analysis, team features, and optional live image generation.
