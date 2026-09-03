# Sprint 14.2 Completion — Pending, Reconsideration & CLI Follow-Up

Starting SHA: `29e5f17`

Implementation SHA: recorded by the commit containing this report.

Added durable `PostRoundFollowUp` records with governed kind/status/version state and one idempotent initialization command that builds a shared active `POST_ROUND` Plan and structured Plan items from canonical pending, approved-limit-pending, and declined application facts. Required factual follow-up is distinguished from optional reconsideration.

Structured completion atomically claims the follow-up version, appends a `CreditApplicationEvent`, updates the owning canonical `CreditApplication`, and completes the linked Plan item. Duplicate requests replay through the governed idempotency primitive; stale versions fail closed. Unable-to-complete records that state while leaving required work incomplete. Application/round/Plan projections are invalidated through outbox and realtime domains.

Added the client PORTAL-32 route `/app/rounds/:roundId/follow-up` with normalized result and known-limit capture, explicit unable-to-complete behavior, loading/error/empty states, and mobile controls. One additive migration creates the enum-backed follow-up model; no historical migrations were modified.
