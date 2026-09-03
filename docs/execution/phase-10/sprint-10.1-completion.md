# Sprint 10.1 — Card Product, Issuer & Offer Catalog — Completion

## Boundary

- Starting SHA: `5131e066c4f5b2e4dac4a63f17bd8fc693f165e0`
- Implementation/report boundary: this commit; exact SHA is recorded in the Phase 10 gate ledger.
- Branch: `rapid/phase9-12-plan-cards-strategy`

## Delivered contract

- Added canonical issuer and stable product identities with aliases, lifecycle, personal/business/secured/non-reporting classification and safe asset reference.
- Added immutable `CardOfferVersion` history, atomic current pointers, effective/freshness state, material fingerprint and source evidence.
- Added positively selected current and historical catalog queries. Expired promotional fields are suppressed and marked stale rather than presented as current.
- Added governed catalog capabilities, audit and duplicate-safe outbox publication.
- Added a forward-only migration and deterministic fixtures covering personal, business, secured and non-reporting products plus one stale promotion.

## Verification

- Focused catalog integration covers immutable history/current pointer, safe DTO selection and source URL allowlisting.
- Prisma schema/client generation and forward migration succeeded against `credit_strategy_phase9_12_block`.
- System and demo seeds succeeded; repeatability is re-proved at the phase gate.
- API typecheck and repository lint are required green before this boundary is committed.

## Scope and deviations

- Existing Phase 6 `ClientCard` remains the sole client portfolio aggregate.
- Product retrieval/candidates are deferred to 10.3; CardInsight is deferred to 10.4; no Phase 12 Strategy or Apply behavior was introduced.
- The supporting research source was not treated as production truth. Demo names and facts are explicitly synthetic fixtures.
