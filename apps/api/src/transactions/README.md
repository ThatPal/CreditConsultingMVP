# Consequential command transaction pattern

Use `executeConsequentialCommand` for a consequential write that requires governed idempotency, append-only audit evidence, and durable outbox intent.

The helper performs one Prisma transaction in this order:

1. Check the scoped identity `(scope, subjectId, operation, key)` and reject request-hash reuse or deterministic in-progress duplicates.
2. Acquire a new idempotency record, or retry a previously failed record.
3. Run the caller's canonical business-state mutation.
4. Append an `AuditEvent` through `appendAuditEvent`; ordinary application code has no audit update/delete service.
5. Append a `PENDING` `OutboxEvent`. No publisher, queue, or external effect runs inside this transaction.
6. Store the JSON result and mark idempotency `COMPLETED`.
7. Commit all four effects together.

Any failure rolls back the business mutation, audit event, outbox event, and processing state together. A safe `FAILED` idempotency outcome is then recorded without raw error details. Repeating a completed key returns the stored result without executing the mutation again. Event/audit payload guards reject credential, secret, card-number, and file-byte fields.

The outbox is intent only in Sprint 1.2. Do not add polling, publishing, Redis, BullMQ, or realtime delivery here.
