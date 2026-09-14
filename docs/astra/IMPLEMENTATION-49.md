# Pass 49: Approval confirmation and real staff recovery

## Delivered

Approval acceptance is recorded in the interface before refreshing the builder. A failed follow-up read no longer converts accepted approval into a failed mutation. The interface states that the version was published and requires checking the latest publication before further edits, saves, reconciliation, cancellation or approval. A failed approval request similarly requires an explicit publication refresh; closing the preview cannot bypass this requirement.

Recovery reads publication state without submitting approval again. Failed recovery retains the gate and offers retry. Successful recovery reloads the editor and its related collections and closes the old preview, so the consultant reviews the current state before any further action. Existing expected-version and publication-snapshot checks remain unchanged, as does the identity verification recovery link.

## Verification

Thirty-five component tests passed (19 builder and 16 response-review cases), including accepted approval followed by failed reads, unknown approval followed by failed recovery, closing the dialog, write blocking, and successful recovery without duplicate approval. Scoped lint, whitespace checks, API compilation and web production build passed.

An isolated real-browser scenario signed in with the existing synthetic consultant authenticator, created a dedicated synthetic client and canonical staff assignment, and created its Plan through the authorized API. Approval and consultant verification were both sent from the UI to the real API. The browser intercepted only subsequent reads with controlled 503 responses. Manual recovery succeeded for both operations. Counters recorded one approval POST and one decision POST; direct database checks confirmed an ACTIVE Plan, a COMPLETED step and exactly one recorded outcome. No preexisting client Plan or responses were changed. The generated client, assignment, Plan, user and related work/outbox/audit/outcome records were removed in the fixture cleanup.

Initial fixture work correctly received 403 when the canonical assignment was missing; only the isolated fixture assignment was added. Initial browser timing restored reads before automatic retries ended; the final run kept failures in place until manual recovery was enabled. Test fixtures were corrected to return the proper execution shape and wait for dialog exit. These preliminary failures were resolved before the passing checks above.

## Remaining

This qualifies initial approval and consultant-owned completion through accepted-write/failed-read recovery. It does not yet qualify client correction/resubmission, lost approval response replay, concurrent multi-consultant approval, or separate-Plan replacement policy. Recovery requires re-reading state; no new durable replay API was added. The current pass adds no new visual composition or full accessibility audit. A1/A2/A5 and the wider roadmap remain in progress. No API runtime change, migration, push or deployment occurred; other project versions remain untouched.
