# U1 batch 21 — Failed-refresh recovery and acceptance closeout queue

Baseline c53e0ab; Astra only. KEEP private draft/concurrency machinery; RECONCILE reference-slice failure/retry behavior. Supports F07 cross-surface update reliability and F20 recovery evidence without claiming either finding production-complete.

A failed Plan read while a response is dirty now explicitly pauses draft saves and consequential submissions and provides Retry Plan check. Current text stays editable. Retry confirms the current server context: unchanged business content releases the pause; changed Plan content keeps the existing explicit update-review workflow. The inherited pause copy covers both failed confirmation and pending updates accurately.

Snapshot comparison excludes only workspace.generatedAt and workspace.refreshAt. All business content remains significant, including focus, Profile state, instructions, summary permissions, versions, response history and source identities. A metadata-only refetch no longer creates a false changed-Plan prompt. Server command checks and saved-draft identity checks remain authoritative.

## Evidence

- 23 unique web tests pass across Plan live updates, saved responses, response controls and read identity. New tests cover failed refetch, same/changed-context retry, text preservation, disabled saves/submission and direct form-submit protection. Identity tests retain focus/currentness/permission/instruction sensitivity.
- Five-package build and root lint pass.
- Isolated browser exercises a timed failure, automatic read retries and user-triggered successful retry. Unsaved text survives; writes are paused while unconfirmed; a metadata-only successful read does not prompt for a changed Plan. No page errors. Synthetic login, controlled response failures, and all non-read requests blocked after login. Initial test teardown raced an in-flight retry; the harness now waits for successful recovery and drains routes before closing.
- No API/schema changes or process restart required. Web changes served by Astra Vite; other versions untouched.

[U1 acceptance worklist](U1_ACCEPTANCE_WORKLIST.md) now provides a bounded functional/UI/quality closeout queue and evidence gaps. Next is a valid persisted Round/approved Strategy/Appointment/Live fixture, then the combined reference-state and accessibility matrix. Later-wave domain migration is not incorrectly treated as an automatic U1 prerequisite; unsupported U1 behavior still needs an explicit disposition.

U1 NOT PASSED. This is not a completion report.

Final mobile inspection moved Retry Plan check onto a separate action row at narrow widths. Mobile failure/retry/overflow checks passed again; final web TypeScript and targeted lint pass.
