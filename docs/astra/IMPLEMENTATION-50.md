# Pass 50: Client follow-up clarity and correction roundtrip

## Delivered

Correction requests and resolved help messages now have one step-level callout above the response editor. The consultant's message is followed by explicit client next-step wording, and help guidance explains that reopening does not mark completion. During a source pause, feedback stays readable without inviting submission. It also remains outside the editor's saved-draft recovery choice.

The callout requires a client-owned, available/in-progress step and the latest matching outcome identity. Historical corrections do not reappear after resubmission, completion or a lock. The previous brief alerts inside the response form were removed to avoid duplication. Initial inspection missed those form-level alerts; browser visual review caught the duplicate and the final version consolidates them rather than adding a second message.

## Verification

Forty focused tests passed: 13 web tests across follow-up, Plan page and response suites, plus 27 Plan authoring/execution database tests. Coverage includes correction/help copy, paused wording, stale evidence, completed/waiting/locked steps and new submissions. Existing database coverage reran simultaneous different-Plan approval attempts and confirmed one publication succeeds while the competing stale preview is rejected. Existing correction tests preserve history, reject outdated evidence and keep dependencies locked until verification.

A dedicated synthetic client used a separately created credential and normal browser sign-in. The consultant used the established MFA flow in a separate browser context. Real API/UI actions completed client submission, consultant correction, client resubmission and consultant verification. Database history contained exactly COMPLETE, CORRECTION_REQUESTED, COMPLETE, VERIFIED in order. The new prompt appeared after correction and disappeared after resubmission. The 390x844 screenshot was visually reviewed; the final repeat also checked that the old duplicate banner was absent. No network response was mocked in this roundtrip. The generated client, credential/user, assignment, Plan and related test data were removed by scoped cleanup.

Scoped lint, whitespace checks, API compilation and the final web production build passed. The existing pg concurrent-query deprecation warning appeared in the database suites. No API code, migration or runtime restart changed.

## Remaining

Separate-consultant browser contention, lost-response durable replay, attachment replacement during correction and broader publication policy remain open. Database concurrency evidence is not a completed multi-session browser qualification. This pass improves feedback placement and wording, not the overall Plan page composition. A1/A2/A5 and the wider roadmap remain in progress. Other versions remain untouched; no push or deployment occurred.
