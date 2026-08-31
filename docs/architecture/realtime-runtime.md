# Realtime runtime boundary

Socket.IO plus the Redis adapter is the canonical realtime transport. Durable business
transactions write `OutboxEvent`; the worker claims pending rows with PostgreSQL
`FOR UPDATE SKIP LOCKED`, submits stable event-ID BullMQ jobs, and publishes only minimal
client-safe refetch envelopes after successful processing. Socket subscriptions and every
delivery are authorized from the current server-side session and canonical policy.

The existing `/api/v1/live-updates` SSE route and in-process event bus remain isolated as a
temporary compatibility surface for pre-Sprint-3.1 handlers. They are deprecated: new code
must not publish through them. Each legacy mutation will move to transactional outbox writes
as its owning workflow is reconciled; the SSE route and `liveUpdates.ts` are then removed.
They are not part of the canonical worker or Socket.IO delivery path.

Presence uses expiring Redis keys and is refreshed while a socket remains connected. A
reconnect performs a fresh handshake and subscription authorization, and the subscribe
acknowledgement instructs clients to refetch. Authorization is checked again immediately
before each delivery, so revocation removes the socket from the client room without waiting
for reconnect.
