# Pass 19: First-save replay protection

A lost POST response could previously leave the editor unaware that a new Plan existed and create another on retry.

## Delivered

- Optional validated Idempotency-Key on Plan creation, using the existing transaction-backed command infrastructure. Keys are scoped to consultant and client; a canonical content hash rejects reuse for different content. Creation, replay result, minimal audit and outbox records commit together. Replays return the original IDs and do not duplicate those events.
- The editor always supplies a creation key and persists it in its existing tab recovery record before sending. Uncertain requests keep their draft immutable while Save draft retries the same request. Reload recovery retains the key and disables discarding an unresolved request through that recovery dialog.
- A known domain rejection after transaction rollback returns PLAN_CREATE_REJECTED. The editor then releases the pending key and allows correction. Unknown transport/server failures retain it. Publication remains a separate approval command.

## Evidence

Eight API authoring integration tests and 16 consultant editor tests pass. Added concurrent triple replay (one Plan/audit/event), changed-content rejection, definitive rollback, lost-response tab reload/retry with the same key, and editor unlocking after confirmed rejection. API/web builds, scoped lint and whitespace checks pass; existing pg and bundle warnings remain. No migration. Verified Astra API alone restarted; readiness checked separately. No authenticated consultant visual evidence added.

## Remaining limits and next work

Recovery relies on the existing tab record: its 24-hour retention, logout cleanup, manual storage clearing and cross-device access remain limitations. Legacy callers without a key still use the original contract; migrating all creation surfaces is open. Request replay does not establish complete end-to-end operational qualification. Cancellation/formal replacement rules, consultant browser/MFA qualification, other A5 gaps and wider roadmap waves remain open. A1/A2/A5 are in progress; Astra isolation is preserved.
