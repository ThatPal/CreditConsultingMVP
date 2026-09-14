# Pass 20: Grouped private-Plan lifecycle batch

Delivered as one related implementation/test batch followed by one API build and one web build, run together.

## Scope and policy

The cached detailed UX contract calls for retained history and governed supersession but does not define a full cross-Plan cancellation/replacement policy. This pass therefore implements only cancellation of a saved, never-published private Plan with no Round references. It does not cancel active client instructions or claim formal published-Plan replacement is complete.

## Delivered together

- Consultant cancellation control, required reason, concrete impact dialog, pending-write navigation protection, immutable retry payload/key, failure feedback and saved-Plan refresh.
- Scoped review.publish command with an expected revision and transaction-backed idempotency. The Plan lock serializes cancellation with edits/approval. Published/activated/replacement versions and Round-linked versions are rejected. Closed Plans remain immutable through existing guards.
- Plan and version statuses become cancelled without deleting items, versions or evidence. Scoped generated Plan review reminders are cancelled; other work is not included in the update predicate.
- One audit/outbox event per accepted command, with the reason retained in the audit. Version history exposes cancellation date/reason to authorized consultants; the existing library/history-only experience handles the closed Plan.

## Verification

- All six Plan API suites pass, 50 tests. Added cancellation replay, retained history and current publication, reminder closure, foreign-client rejection, changed-revision rejection, published-Plan rejection and concurrent edit/cancel coverage. Route tests cover auth, role, client scope and invalid reasons.
- 18 distinct relevant web cases pass across runs. New cancellation test verifies reason gating, explained publication impact and identical request replay; history coverage includes the cancellation reason. The initial retry test asserted before the asynchronous mutation started; corrected waits pass.
- One grouped build run: API and web each built once after the implementation was complete; both passed. Scoped lint and whitespace checks passed. Existing pg deprecation and bundle-size warnings remain. No migration.
- Only the verified Astra API process was restarted after builds. Readiness is checked separately; protected branch heads remain unchanged. Consultant visual/accessibility qualification is still pending MFA and is not claimed by this evidence.

## Next grouped work

Published-Plan replacement requires explicit handling of outstanding client work, history, source/readiness links and current-publication handoff. That remains open, along with client multi-Plan presentation, durable cross-device recovery, old queue-link remediation and operational/browser qualification. A1/A2/A5 remain in progress; wider roadmap waves are unchanged. Continue grouped features with builds at the batch boundary.
