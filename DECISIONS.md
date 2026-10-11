# Engineering decisions for consultation

The owner selected a **Cursor / VS Code extension**, **TaniaPewah/ReviewIsFun, public**, **TypeScript + React webview**, **Codex SDK with Codex login**, and **cosmic exploration**. These decisions are agreed. Other choices below remain recommendations unless recorded as agreed. Present each engineering decision's alternatives, recommendation, reason, and tradeoffs, then wait for the owner's choice before dependent implementation. An unanswered question is not approval. Add decisions as new engineering questions arise; this initial list does not exhaust future choices.

| Decision | Meaningful alternatives | Recommended choice | Reason and tradeoff |
| --- | --- | --- | --- |
| First surface | Cursor/VS Code extension; Codex skill in chat; standalone web app | A VS Code extension intended for Cursor | A custom panel can enforce pauses and control code excerpts, questions, points, and visual rewards. A chat skill is faster to prototype but has less UI control. Editor installation and Cursor compatibility must be tested. |
| Codex integration | Extend Codex IDE UI; use Codex SDK; direct model API | Evaluate Codex SDK as the first provider behind a small adapter | A documented SDK exists; no documented Codex IDE UI extension API was found. Access, authentication, runtime compatibility, and costs must be verified before choosing. |
| AI access | Existing Codex account via supported login; separate API key; editor-provided models | Consult before selecting the provider | These have different costs and prerequisites. A VS Code model API does not establish access to Cursor's own models. No credentials or model access have been verified for this project. |
| Language | TypeScript; JavaScript | TypeScript | Matches the editor API and SDK ecosystem and gives useful checks on assessment messages and state transitions. Adds a compilation step. |
| Panel implementation | Plain HTML/TypeScript; React with Vite; editor-native views | React with Vite in a webview, subject to platform choice | Multiple interactive states, code cards, accessibility, and reward components benefit from component structure. This adds dependencies and bundling; a smaller plain panel remains a reasonable alternative. |
| Runtime boundary — agreed | Extension host and webview; separate local server; hosted backend | TypeScript extension host plus React webview | The owner chose this runtime split. Git, Codex execution, assessment processing, and storage run in the host; React renders the interaction. No separate application server is selected. |
| Git integration | Git extension API; Git CLI; Git library | Git CLI with argument-array execution and tested parsing | Works against explicit committed snapshots and is easy to exercise with temporary repository fixtures. Requires Git and careful path/binary/rename handling; never build shell command strings from repository data. Reassess against the built-in Git API during implementation. |
| Snapshot | Live working tree; changing HEAD; fixed SHA | Freeze commit and parent SHAs at session start | Explanations and assessment remain tied to stable evidence while editing or committing continues. Show the comparison base. |
| Review highlight selection — agreed | Major technical decisions; one diff hunk; one changed file | Select major technical decisions from the whole commit; one selected decision per guided review highlight | The owner clarified that highlights are major engineering choices, not every diff or changed file. A choice may span several files/hunks, while routine changes need no separate highlight. Grouping/selection algorithms and excerpt size require consultation. |
| Explanation evidence | Assert author intent; label inferred rationale | Ground explanations in exact code and label inference | A diff shows what changed, but cannot prove every choice the author considered. Clearly distinguish observable behavior from possible rationale. |
| Understanding-check format — agreed | Short free-text reviewer question; multiple choice; free text with optional choices | Short free-text reviewer question after each highlight | The owner selected conversational free-text answers. This can reveal reasoning while preserving the guided review feel. Assessment criteria, points, and progression remain separate open decisions. |
| Answer assessment — agreed | AI against prepared criteria; overall AI judgment; semantic comparison with a reference answer | AI evaluation against a few criteria prepared before the answer | The owner chose criteria-based AI assessment. Findings should explain what the answer demonstrates and accept valid alternative reasoning. Criteria generation/validation, scoring, and progression remain separate engineering decisions. |
| Incomplete-answer handling — agreed | Focused follow-up; explanation and fresh answer; continuation with unresolved marker | Stay on the same highlight and ask a focused follow-up when a criterion is missed or assessment is uncertain | The owner chose targeted clarification. This preserves the guided review flow while focusing on the gap. Conversation-state storage and assessment of multiple answers still need engineering consultation. |
| Readiness and follow-up limit — agreed | Essential-criterion gate; 80% overall gate; user discretion | At least 80% overall unlocks the explicit Continue action; at most one follow-up per review highlight | The owner chose the overall threshold and capped follow-ups. "Item" is interpreted as a review highlight, pending correction. If the follow-up still scores below 80%, progression behavior is unresolved and must be consulted. |
| State management — agreed | Pure host reducer with typed entities; XState; React component state | Typed domain entities and a pure TypeScript reducer in the extension host | The owner chose a host reducer. React sends actions and renders validated state. Exact entity fields, transitions, persistence, and exhausted-follow-up behavior still need consultation. |
| Chat presentation — agreed | Custom React side-panel chat; custom React editor tab; native editor chat participant | A dedicated React chat view beside code | The owner selected a custom view beside code. Use a WebviewView-based chat interface, with short snippets and start, highlights, feedback, rewards, and recap in the conversation. This is separate from the editor's built-in AI chat. |
| AI generation flow — agreed | Select decisions then generate on demand; generate shortlist and all highlights together | First select the commit's major technical decisions and code references; generate each highlight on demand | The owner selected the two-stage flow. This separates commit analysis from presentation and bounds what is generated at once. Selection schema, context limits, caching, and error recovery still need consultation. |
| XP | Model chooses points; deterministic rubric scoring; speed rewards | Up to 100 XP per checkpoint, deterministic criterion scoring | Transparent and consistent. Revisions earn only the increase; no penalties for help and no speed pressure. The exact weights remain a product choice. |
| Progress storage | Workspace-local storage; repository files; cloud database | Editor workspace storage | Resumable without modifying the reviewed repository or requiring accounts. Cross-device sync is outside the initial scope. |
| Artwork | Generate on each answer; bundle custom images; CSS-only effects | Bundled custom artwork and short animations | Fast, reliable celebration without repeated generation latency/cost. Visual style is a consultation decision; reduced-motion support is required. |
| Review trigger — agreed | Automatic opening after each commit; manual command; notification | Notify after each new commit; owner chooses when to start | The owner explicitly selected notifications. This makes each commit discoverable while preserving control over when a walkthrough begins. Commit-detection mechanics and missed-commit handling still require separate consultation. |
| Code privacy | Send whole repository; minimal relevant excerpts; local model only | Minimal excerpts and explicit provider disclosure | Reduces unnecessary sharing and cost. Larger context is added only when needed; model choice can change the privacy boundary. |
| Tests | UI snapshots only; core tests plus Git integration and editor smoke tests | Vitest for core logic and Git fixtures, editor smoke tests for real walkthrough | Meaningful checks cover gates, XP, parsing, persistence and the actual extension surface. A successful fixture demonstration alone does not verify real model assessment. |
| Repository identity — corrected and agreed | Existing ReviewIsFun; new public or private repository | Existing public `TaniaPewah/ReviewIsFun`, branch `main` | The owner explicitly redirected the checkpoint to the existing repository. This supersedes the earlier request for a new ReviewQuest repository. Preserve its existing MIT license and local/remote work. |

## Decisions to resolve first

1. Major implementation architecture: runtime boundaries, screens, flow, and entities. See [ARCHITECTURE.md](ARCHITECTURE.md).
2. Git integration and commit detection, state management, storage, bundling, and tests.
3. Decision grouping, code grounding, model context, and evaluation of the initial answer plus one follow-up.
4. Points, celebrations, and the exhausted-follow-up state still need consultation.

## Foundation decisions presented before implementation

Fixed commit snapshots, argument-array Git commands, and application-owned progression/XP were presented but were not individually approved. Some local implementation was started prematurely. That work is paused and must not be treated as an agreed architecture. Consult the owner before implementing or adopting each remaining choice.

## Sequential consultation

1. **Review trigger — agreed:** notify after each new commit; the owner chooses when to start.
2. **Review highlight grouping — agreed:** one technical decision per guided review highlight; the experience should feel like reviewing code together rather than a lesson.
3. **Understanding-check format — agreed:** a short free-text reviewer question after each highlight.
4. **Answer assessment — agreed:** AI evaluation against criteria prepared before the answer, accepting valid alternative reasoning and providing specific findings.
5. **Incomplete-answer handling — agreed:** stay on the same highlight and ask a focused follow-up when understanding is incomplete or assessment is uncertain.
6. **Readiness to continue — agreed:** at least 80% overall; one follow-up maximum per review highlight (interpretation of "item"). The owner explicitly requested that further consultation cover major implementation/code decisions, including stack, flow, screens, and entities.
7. **Runtime — agreed:** extension host plus React webview.
8. **State management — agreed:** typed domain entities with a pure host reducer.
9. **Chat presentation — agreed:** a custom React chat view beside code, using one conversation with short snippets.
10. **Major-decision selection/generation — agreed:** select the commit's major decisions first, then generate each highlight on demand. A diff/file is not inherently a highlight.
11. **Git integration, storage, and build tooling — pending:** next major implementation choices for consultation.
12. **Checkpoint repository — corrected:** commit the current work to the existing `TaniaPewah/ReviewIsFun` repository on `main`, and provide local prototype testing instructions. The extension working name remains ReviewQuest.

The 80% product gate is now agreed. The earlier local prototype's additional mastery conditions and data structures remain unapproved; this choice does not approve that implementation. The one-follow-up limit is not implemented in the prototype.

Notification behavior is selected; its implementation remains paused until the relevant engineering dependencies have been discussed and chosen.

## Official technical references

- [VS Code webview guide](https://github.com/microsoft/vscode-docs/blob/main/api/extension-guides/webview.md): custom HTML panels, messaging, local assets, and UI state.
- [VS Code Git API](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts): alternative integration for repositories and committed contents.
- [VS Code language-model guide](https://github.com/microsoft/vscode-docs/blob/main/api/extension-guides/ai/language-model.md): model selection and access limits; does not document Cursor-native model access.
- [Codex TypeScript SDK](https://github.com/openai/codex/blob/main/sdk/typescript/README.md): CLI-backed integration, streaming, and structured output.
- [Codex README](https://github.com/openai/codex/blob/main/README.md): Codex IDE availability includes VS Code, Cursor, and Windsurf; this does not prove a third-party UI extension API.

The official GitHub mirrors were consulted. Cursor compatibility and a working model connection remain unverified until implementation and runtime testing.
