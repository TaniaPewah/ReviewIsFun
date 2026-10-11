# Product specification — proposed MVP

Agreed: notify after each commit and let the owner choose when to start; organize the walkthrough as one technical decision per guided review highlight; ask a short free-text reviewer question; assess answers using AI against criteria prepared before the answer; stay on the same highlight and ask a focused follow-up when understanding is incomplete or uncertain. Other behavior and engineering details below remain proposals for sequential consultation.

## Goal

Make reviewing a commit feel like reviewing code together in a custom React chat view beside code: short actual code snippets, manageable explanations, explicit understanding checks, useful alternatives, and joyful rewards. Review highlights are selected major technical decisions from the commit; every diff or changed file is not inherently a highlight. Start and recap belong to the same conversation rather than separate pages. Select the commit's major decisions first, then generate highlights on demand.

## Essential experience

1. Notify after each new commit and let the owner choose when to start its review. Manual commands and commit-history selection are additional proposals. Commit detection and missed-commit handling need consultation.
2. Capture the selected commit SHA. Present its message, comparison base, changed files, and an approximate number of review highlights.
3. First select the major technical decisions worth discussing after examining the commit. Generate each selected decision's highlight on demand and present it in the chat conversation, with short real before/after excerpts, file paths, and original line references. A decision may span several files/hunks; routine changes do not require individual highlights. The selection algorithm, exact excerpt limit, and expandable-context behavior remain open choices.
4. Explain the observed behavior, why this approach may be useful, and at least one relevant alternative with a concrete tradeoff. Identify inferred rationale as inference; cite author rationale only when supplied by commit messages, comments, or documents.
5. Ask a short free-text reviewer question about the highlighted decision, then stop and wait for the answer. Example review prompts include explaining behavior, predicting an outcome, or comparing alternatives.
6. Use AI to evaluate the answer against criteria prepared before it was submitted. Accept valid alternative reasoning and explain the assessment findings. If understanding is incomplete or uncertain, stay on the same highlight and ask at most one focused follow-up per highlight. At least 80% overall unlocks the explicit Continue action. Partial credit, how multiple answers contribute to an assessment, and the state after an unsuccessful follow-up require separate consultation.
7. Celebrate a strong answer or meaningful improvement with artwork, brief motion, and specific praise explaining what the learner understood.
8. Stop again. Only an explicit **Continue** action starts the next highlight once its assessment reaches at least 80%. There is at most one follow-up per highlight. Skip behavior and what happens if that follow-up remains below 80% are unresolved decisions; never silently unlock progression or ask unlimited follow-ups.
9. Post the recap in the same chat conversation: earned XP, major decisions discussed, outstanding questions, and an honest account of inspected or excluded changes. Do not equate passing selected questions with understanding every change.

## Points and verification

Proposed maximum: 100 XP per checkpoint, allocated to understanding (50), reasoning (30), and tradeoffs (20). Adjust criteria to the actual question and show the rubric. Credit sound alternative approaches and equivalent phrasing.

Revisions can earn the remaining XP. Hints have no penalty. Persist the highest earned score and add only the improvement, so repeated submissions cannot farm points. The application calculates XP from validated criterion scores; a model cannot choose arbitrary XP or unlock the next review highlight. These scoring and progression mechanics remain proposals.

If assessment is uncertain, request clarification and explain the uncertainty. Provide a challenge/reassessment path. Do not grade by keywords alone or claim mathematical certainty about free-text understanding.

## Commit coverage

- Default: selected `HEAD` versus its first parent, frozen for the whole session.
- Initial commits: compare against an empty tree.
- Merge commits: show the first-parent comparison explicitly; deeper parent analysis is a later capability.
- Renames and deletions: retain appropriate before/after paths and code references.
- Binary, generated, and lockfile changes: summarize appropriately and display why they received a summary rather than a code review highlight.
- Large commits: split into technical decisions, expose remaining coverage, and let the reviewer resume. Never silently truncate a commit and call it fully reviewed.
- Every commit is eligible for its own session. Notify after each new commit; the owner chooses when to begin. History and backlog behavior remain open decisions.

## Visual rewards

Use a small set of striking, locally bundled celebration images with milestone-specific animation and cheerful feedback. Create custom artwork once the visual direction is agreed. Immediate rewards should work without an image-generation request for every answer.

Support keyboard navigation, screen-reader announcements, reduced motion, sufficient contrast, and celebrations that do not obstruct the code. A learner can turn off motion and sound.

## Data and boundaries

Local progress is proposed for the first version. Proposed session keys combine repository identity, commit SHA, review-highlight ID, and review version. Accounts, leaderboards, cloud storage, and persistence mechanics have not been selected.

Source code may be sent to the configured AI provider. Show the destination and scope before sending, minimize context, and exclude known sensitive paths. This is a best-effort filter, not a promise that arbitrary code is free of secrets.

Repository text and learner answers are untrusted data. They cannot instruct the extension to execute commands, edit source code, change the rubric, reveal credentials, or bypass progression. Review is read-only.

## First-version acceptance criteria

- A known test commit produces review highlights organized around technical decisions, with excerpts that match committed files and line references.
- Before an answer and after feedback, no automatic transition reveals the next review highlight.
- Correct, partial, alternative, uncertain, and off-topic answers produce distinct, useful outcomes.
- Duplicate submissions do not duplicate points; a better revision awards only the increase.
- Reloading resumes the same commit, review highlight, feedback, and XP.
- A changing `HEAD` does not change an active session.
- Initial commits, deletions, renames, and first-parent merge comparisons are handled or explicitly reported unsupported before a session starts.
- Generated and binary changes remain visible in the coverage map.
- Failed model calls preserve progress and allow retry without duplicate XP.
- Keyboard-only and reduced-motion flows work.
- Build, unit and Git-fixture integration checks pass. Installation and walkthrough behavior are verified in VS Code; Cursor compatibility is reported separately after testing.

## Proposed delivery order

1. Agree on platform, repository identity, and AI access approach.
2. Implement the small-step panel and deterministic progression/XP engine using labelled fixtures. Fixture mode is a UI development tool, not validation of real AI assessment.
3. Add actual Git snapshots, diff excerpts, and coverage tracking.
4. Add grounded decision grouping and review-highlight generation, plus the agreed understanding-check mechanism.
5. Add custom celebration artwork, accessibility, persistence, and error recovery.
6. Package the extension and test a real commit end to end in the intended editor.

Later: difficulty settings, spaced repetition, review history/backlog, richer merge analysis, team features, and optional live image generation.
