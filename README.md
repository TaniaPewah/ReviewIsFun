# ReviewQuest

A joyful, guided code review that explores one technical decision at a time.

A new project requested by TaniaPewah. Planning documents, local scaffolding, core/Git prototypes, and cosmic artwork exist. Implementation is paused for sequential consultation; a working extension has not been completed.

## The experience

Choose a commit → inspect a small real code change → understand the decision and alternatives → answer one question → get feedback and XP → celebrate → choose to continue.

The agreed experience is one technical decision per guided review highlight, with a notification after a real new commit and an explicit Start. Scoring, the one follow-up, Skip, and XP are agreed in A16–A18. It should feel like reviewing code together.

## Proposed first version

The owner selected a TypeScript/React VS Code extension, Codex SDK with Codex login, and cosmic exploration artwork. Cursor compatibility and a live model connection still need testing.

Read [SPEC.md](SPEC.md) for the product flow and acceptance criteria, and [DECISIONS.md](DECISIONS.md) for engineering alternatives, recommendations, and decisions needing consultation.

## Current status

- A local Git repository has been initialized on `main`.
- A13–A23 are agreed in the architecture and decision documents. Exclusion patterns, excerpt sizes, prompt wording, and numerical context budgets remain open. Implementation has not started from those choices.
- Some scaffolding and core/Git prototype code were started before all dependent choices were consulted. That work is paused and does not imply approval of its architecture. Packages and one cosmic celebration image are present; no credential values were added or copied.
- The owner selected the existing public repository [TaniaPewah/ReviewIsFun](https://github.com/TaniaPewah/ReviewIsFun). Its existing MIT license is preserved. ReviewQuest remains the extension's working name.
- TypeScript checking and all 37 core/Git prototype tests passed for this checkpoint. The extension, UI, and live model connection have not been validated end to end.

## Test on your machine

Use Node.js 24 and Git:

```bash
git clone https://github.com/TaniaPewah/ReviewIsFun.git
cd ReviewIsFun
npm ci --ignore-scripts
npm run typecheck
npm test
```

See [TESTING.md](TESTING.md) for test coverage and current limitations. The chat UI and extension entry point are not implemented yet, so this checkpoint is not installable as a functioning extension.

## How we will collaborate

For each engineering decision, present the problem, meaningful alternatives, recommendation, reason, and tradeoffs. Wait for the owner's choice before dependent implementation. An unanswered question is not approval. Record each agreed choice in the decision log and revisit it when evidence changes.
