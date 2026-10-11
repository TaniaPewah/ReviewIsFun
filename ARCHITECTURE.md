# Implementation architecture for consultation

Status: a concrete proposal, not permission to implement the remaining choices. Some earlier local scaffolding exists; it does not establish approval of these recommendations.

## Confirmed constraints

- Cursor / VS Code extension, using TypeScript and a React webview.
- Runtime: extension host plus React webview. State: typed entities with a pure host reducer.
- Codex SDK with supported Codex login; cosmic exploration visual style.
- Repository: the existing public TaniaPewah/ReviewIsFun, branch main, as corrected by the owner. Preserve its existing MIT license. ReviewQuest is the extension's working name.
- Notify after each new commit; the owner chooses when to start.
- Select major technical decisions from each commit; one selected decision per guided review highlight with short actual code snippets and relevant alternatives. A changed file or diff hunk is not inherently a highlight.
- One custom React chat view beside code, implemented through a WebviewView. Start, highlights, feedback, rewards, and recap share one conversation; separate inbox/review/summary pages are superseded.
- Two-stage AI flow: select the commit's major technical decisions first, then generate each highlight on demand.
- Short free-text reviewer questions; AI assessment against criteria prepared before the answer.
- Stay on the highlight for a focused follow-up when needed; at most one follow-up per highlight.
- At least 80% overall unlocks Continue; progression still requires the owner's explicit action.

"One follow-up per item" is interpreted as one per review highlight. Clarify if the owner means one per criterion instead.

## Major choices to consult

| ID | Decision | Recommendation | Alternatives and tradeoffs | Why recommend it |
| --- | --- | --- | --- | --- |
| A1 — agreed | Runtime boundaries | One extension host plus a React webview; no separate application server | A local server enables a separate browser app but adds ports and process lifecycle. A hosted backend enables accounts and sync but adds deployment, authentication, and source-data storage. | Git and Codex need Node access; the webview provides the rich UI. Existing editor infrastructure supplies both. Codex still uses an online model service. |
| A2 — agreed | Chat presentation | A custom React WebviewView beside code, with one conversation and short snippets | A React editor tab provides more width. A native VS Code chat participant uses the editor's chat rendering rather than arbitrary React; Cursor support would require verification. | The owner chose a dedicated chat beside code. The earlier three-view proposal is superseded. |
| A3 — agreed | Session and UI state | A pure TypeScript reducer/state machine in the host; React renders validated state and sends actions | UI-owned state is quick but makes persistence and enforcement fragile. XState offers formal machinery and tooling but adds a dependency. | The host can enforce the 80% gate, one follow-up cap, duplicate-request handling, and explicit Continue independent of model output. Exact entities and transitions remain open choices. |
| A4 | Git integration | Argument-array Git CLI for snapshots; built-in Git events for notifications with reconciliation | Built-in Git API for everything reduces parsing but creates API/compatibility dependence. Filesystem-only watching is simple but can miss linked-worktree refs or non-commit HEAD changes. | Historical snapshots are straightforward to test through Git; editor events help discover changes. Reconciliation mechanics and distinguishing new commits from checkout/reset still require consultation. |
| A5 | Persistence | Versioned JSON in editor workspace storage, keyed by repository plus commit | SQLite supports richer history queries but adds a database/native or WASM dependency. Repository files are visible but can leak answers into commits. Cloud storage enables sync but requires accounts/backend. | Resuming a local review needs simple structured state rather than a server or database initially. History limits and migration rules remain open. |
| A6 | Build and packaging | esbuild for extension and webview bundles; npm lockfile; VSIX package | Vite offers richer browser development features but needs integration with extension packaging. Webpack has mature tooling but more configuration. | Two small bundles and a reproducible editor-installable artifact fit this project. React is approved; esbuild, dependency versions, editor baseline, and packaging details are not yet approved. |
| A7 | Verification | Vitest for state/domain and Git-fixture integration tests, plus editor-host smoke tests | UI-only snapshots cannot establish real Git/model behavior. End-to-end-only tests catch integration but are slower and harder to diagnose. | Test the gate and real snapshots cheaply, then exercise the actual extension surface. The test stack and editor testing method need approval. |
| A8 — generation flow agreed; interface/validation pending | Model integration and validation | Two stages: select major decisions with code references, then generate each highlight on demand. Proposed provider interface around Codex SDK with validated structured output | One request for everything uses fewer calls but generates a larger response. Calling SDK directly from the controller couples prompts and application flow. | The owner chose the two-stage flow. Exact schemas, provider interface, code-reference validation, context limits, and execution restrictions still require consultation. |

## Proposed execution flow

1. Discover the selected workspace repositories and track committed HEAD changes.
2. On a newly detected commit, show a notification. Starting the review is an explicit action.
3. Pin the chosen SHA and its comparison base; read an immutable committed snapshot.
4. Send appropriate changed-code context to Codex through a provider interface.
5. First Codex proposes the major technical decisions worth discussing across the commit, with code references. It selects and groups meaningful choices rather than producing one item per hunk or file. Selection criteria and exact schema still need consultation.
6. Proposed validation: verify selection references against the snapshot and freeze the decision outline. Distinguish examining the commit from discussing every change; report unread or excluded areas honestly.
7. Generate the current highlight on demand: explanation, relevant alternatives, reviewer question, and criteria prepared before the answer. Validate and freeze its definition, then present it in the custom React chat beside code using short actual snippets. Exact generation/validation schemas and diff-opening behavior remain open choices.
8. Send the first free-text answer for criteria-based assessment.
9. If the score is at least 80%, show feedback/reward and enable explicit Continue.
10. Otherwise ask one focused follow-up and reassess. Combining evidence from the two answers is a recommendation, not yet a selected algorithm.
11. If the reassessment is still below 80%, enter an unresolved state. Stop/skip/restart behavior needs a separate decision; do not silently unlock Continue or ask another follow-up.
12. Persist progress as selected by the storage decision. On explicit Continue, discuss the next selected decision; after the last, post the recap in the same chat conversation.

Failures remain distinguishable: Git access failure, model failure, invalid model output, uncertain assessment, and insufficient understanding. Each needs recovery without losing verified progress or duplicating points.

## Agreed chat form and container

The owner requested a single chat-style interface with short code snippets. Start, discussion, feedback, celebration, and recap are conversation phases, not separate pages. The following content is proposed within that form:

| Conversation phase | Contents | Purpose |
| --- | --- | --- |
| Start message | Repository, commit, brief overview, start/resume actions | Begin the review and show what is selected. Backlog semantics need consultation. |
| Decision conversation | Major decision; short exact code snippets; rationale and alternatives; free-text question; assessment/follow-up; reward; Continue | Discuss one major technical decision at a time, preserving the conversational feel. |
| Recap message | Decisions discussed, scores/XP, unresolved items, inspected/excluded areas, next review action | Show what was actually verified and what remains. |
| Native editor settings | Codex CLI/model settings and visual preferences | Reuse existing editor controls for operational configuration. Exact exposed settings remain open choices. |

The owner chose a custom React WebviewView beside code. It is an extension-owned chat interface, separate from the editor's existing AI chat. The conversation contains start, decision discussion, feedback, rewards, and recap.

## Proposed entities

These are logical TypeScript entities. Selecting them does not require a relational database.

| Entity | Important fields | Ownership and relationships |
| --- | --- | --- |
| RepositoryIdentity | id, rootPath, displayName | Local Git repository identity; one repository has many commits and sessions. |
| CommitSnapshot | repositoryId, sha, parentSha, changedFiles, canonicalCodeRanges, comparisonKind | Git is the source of truth. The snapshot owns exact code and line references. A session references one immutable snapshot. |
| ReviewSession | id, repositoryId, commitSha, highlightIds, currentHighlightId, state, version | Application-owned progression across highlights. Persistent shape and version/migration policy need consultation. |
| ReviewHighlight | id, decisionTitle, explanation, rationaleKind, codeRefs, alternatives, question, criteria | One selected major technical decision, potentially across several hunks/files. There is no one-to-one mapping to changed files or diff hunks. Codex proposes selection/narrative/grouping; the app validates codeRefs and freezes the definition. |
| Criterion | id, description, weight | Belongs to a highlight; prepared before answering. Weight selection and validation rules are open. |
| AnswerAttempt | id, highlightId, kind, text, submittedAt | Initial answer or the single allowed follow-up answer. At most two attempts for a highlight under the chosen cap. |
| Assessment | id, highlightId, evaluatedAttemptIds, criterionFindings, scorePercent, confidence, feedback | Evaluates recorded answers against the frozen criteria. Score aggregation and uncertain-result rules remain to be chosen. |
| HighlightProgress | highlightId, status, bestScore, followUpUsed, assessmentIds | Tracks awaiting answer, assessing, follow-up, ready to continue, or unresolved. The state implementation remains unapproved. |
| RewardRecord | highlightId, earnedXp, celebrationTier | App-owned rewards distinct from AI feedback. Award calculation and duplicate prevention require consultation. |

Association summary: Repository → CommitSnapshot → ReviewSession → ReviewHighlight → Criterion; each highlight also has AnswerAttempt, Assessment, HighlightProgress, and RewardRecord records. The snapshot may be shared by several sessions; the exact session/history policy remains open.

## Proposed module boundaries

```text
src/extension/   activation, commands, notifications, controller
src/git/         repository discovery, commit snapshots, canonical code ranges
src/core/        entities, state transitions, score/reward rules
src/ai/          provider interface, Codex adapter, output validation
src/storage/     persistence and version migration
src/shared/      validated host/webview message contracts
src/webview/     React views, code cards, answer/follow-up UI, cosmic rewards
```

The webview sends intent such as submitAnswer or continue. The host validates it and owns Git, provider execution, assessment processing, and persistence. This split prevents UI events or model text from becoming privileged operations.

## Current evidence and limits

- Earlier prototype core/Git tests passed; their implementations are not all approved.
- A working extension, native editor behavior, Cursor compatibility, and live AI assessment are not validated.
- The Codex CLI reports a ChatGPT login; this does not establish a successful model request.
- The owner redirected the checkpoint to the existing public TaniaPewah/ReviewIsFun repository. Creating a new GitHub repository is no longer required.
- Only documentation is changing during consultation. No implementation resumes without the relevant choices.
