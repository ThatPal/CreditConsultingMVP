# Sprint 12.4 Completion — Approval, Publication & Client Projection

- Consultant approval requires canonical `strategy.manage`, active client scope, staff MFA, and step-up verification. Admin role alone has no seeded strategy authority.
- Approval revalidates the deterministic sequence and recomputes the complete authoritative source fingerprint inside the locked transaction.
- The approved `StrategyVersion` is immutable and linked as the one approved version; the Round advances atomically to strategy-ready.
- Strategy state, audit, outbox, client notification, and idempotency result commit or roll back together.
- Focused real-transaction proof injects a failure after mutation, confirms zero partial effects, retries successfully, and confirms one approved version, one audit effect, one outbox event, and one client notification. Same-key retry replays without duplicates.
- Client projection exposes only positive, client-safe approved cards, sequence, timing/dependency/stop/reconsideration rules, and consultant-written reasons. Internal rationale, AI proposal, and approval mechanics remain private. No approval probability is calculated or shown.
- Added Portal 27 at `/app/rounds/:roundId/strategy` and the sustained CRM strategy workspace at `/crm/clients/:clientId/rounds/:roundId/strategy`.
- Focused strategy/Phase 11 integration: 6 passed. API typecheck passed. Web typecheck passed after UI correction.
