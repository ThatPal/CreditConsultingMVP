# Sprint 6.5 — Intake Review & Submission

Status: COMPLETE — local high-risk gate passed; immediate branch CI pending

Branch: `rapid/phase6-8-review-golden-path`

Accepted Sprint 6.4 boundary: `05995e9`

Implementation boundary: `bc0c19a`

## Delivered outcome

- Replaced the legacy submit transaction with a canonical idempotent consequential command.
- The server-owned final checklist requires a validated report/source/date, an explicit changes/no-changes declaration, complete portfolio confirmation, every current card represented, and exactly one reserved Review Credit.
- Submission atomically freezes input versions, marks the report `ACCEPTED`, transitions the Review to `INFORMATION_RECEIVED`, consumes one reserved credit, resolves intake work, creates one canonical Attention item, creates one client notification, and commits one audit/outbox event.
- The frozen source snapshot captures intake version, report identity/checksum/date, card IDs/versions, and canonical update IDs/source keys.
- Incomplete submission consumes zero. Injected failure rolls back Review/report/ledger/Attention/notification/audit/outbox state together.
- Failed same-key attempts can retry to one success. Completed same-key replay creates no duplicate effects. Different concurrent keys still produce one submission and one consumption.
- The durable outbox remains `PENDING` after commit with zero attempts until the worker publishes it, preserving post-commit retry/restart recovery.
- Client re-entry shows queued/consultant-working/completed state and includes a Review-context support link.

## Schema and migration

- Migration `20260902090000_atomic_review_submission` adds immutable `submittedSourceSnapshot` evidence to the canonical Review.
- All 40 historical + Phase 6 migrations deployed successfully without reset or rebuild.

## Verification

- Submission/lifecycle/high-risk API gate: **3 files, 21 tests passed**.
- Connected Phase 6 non-realtime gate: **9 files, 45 tests passed**.
- Realtime command/outbox/socket authorization gate: **1 file, 2 tests passed** on isolated rerun with Credit Redis. The first connected invocation omitted `REDIS_URL`; the first enabled invocation hit a transient socket wait timeout, and the isolated rerun passed without code changes.
- Client Review UI: **1 file, 2 tests passed**.
- API typecheck: PASS.
- Web typecheck: PASS.
- Affected lint: PASS.
- API build: PASS.
- Web build: PASS (existing non-blocking Vite chunk-size advisory only).
- Migration deploy: PASS on Credit-only `credit_strategy_phase6_8_block`.
- Mandatory immediate CI: pending push of this Sprint boundary.

## Exact-once proof counts

After retry and replay of the same submission key:

- canonical Review transition: **1**
- `CONSUME` ledger transaction: **1**
- submission audit event: **1**
- durable outbox event: **1**
- client notification: **1**
- Attention projection: **1**

## Acceptance reconciliation

| Requirement | Result |
|---|---|
| Final server-owned checklist | PASS |
| Atomic reserved-credit consumption | PASS |
| Frozen source versions | PASS |
| Retry/replay/concurrency exact-once | PASS |
| Failure rollback | PASS |
| Audit/outbox/notification/Attention | PASS |
| Worker/restart-safe pending outbox | PASS |
| Processing re-entry and support context | PASS |

## Known limitations

- The outbox worker remains the accepted Phase 3 runtime; Sprint 6.5 does not redesign it. Its pending/retry contract and connected realtime path are regression-tested.
- Consultant analysis and result publication remain downstream Review stages and are not performed during intake submission.

## Boundary confirmation

- No Phase 7 work was started.
- The rapid branch was not merged into `ai-enabled`.
- Only Credit PostgreSQL (`credit_strategy_phase6_8_block`) and Credit Redis were used.
