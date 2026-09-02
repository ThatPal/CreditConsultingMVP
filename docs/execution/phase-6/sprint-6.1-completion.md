# Sprint 6.1 — Review Eligibility & Credit Reservation

Status: COMPLETE

Branch: `rapid/phase6-8-review-golden-path`

Accepted base: `e27b741637c84d9bc1a873b083664404bfd32dae`

Implementation boundary: `c4c8b62`

## Delivered outcome

- Added a canonical, read-only Review eligibility check using the intended report date, newest accepted completed Review report, active Review state, and append-only Review Credit balance.
- Same-date and older reports fail closed. The approximately monthly cadence remains guidance and is not a hidden time gate.
- Starting a Review reserves exactly one credit (`available -1`, `reserved +1`) and does not consume it.
- Start is atomic across Review, intake, ledger reservation, Work Item, audit, outbox, and idempotency record.
- A PostgreSQL transaction advisory lock plus a partial unique active-Review index prevents concurrent duplicate Reviews and overspend.
- Same-key retries replay the canonical result. Different concurrent keys produce only one active Review and one reservation.
- Cancellation has a governed, idempotent release hook that appends a `RELEASE_RESERVATION` transaction and closes its Work Item.
- Active due Review Plans are reconciled into the same durable Review Credit ledger before reservation; purchased credits continue to use the Phase 5 ledger authority.
- PORTAL-10/11 now show intended-date eligibility, explicit blocking/purchase guidance, available/reserved balances, and Start/Resume/Services actions.

## Schema and migration

- Added `CreditReview.intendedReportDate` and the reserved expiry hook `reservationExpiresAt`.
- Added deterministic client/date lookup indexing.
- Added a database partial unique index permitting at most one non-complete/non-cancelled Review per client.
- Preserved all historical migrations; migration `20260902050000_review_eligibility_reservation` deployed cleanly after the existing 35 migrations.

## Verification

- Review lifecycle integration: **1 file, 3 tests passed** — newer/same/older eligibility; exact-once reservation/replay/release; concurrent no-overspend.
- Review UI: **1 file, 2 tests passed** — eligible start with idempotency key and no-credit Services routing.
- Affected high-risk/Commerce regression: **4 files, 21 tests passed**.
- API typecheck: PASS.
- Web typecheck: PASS.
- Changed API/web lint: PASS.
- API build: PASS.
- Web build: PASS (existing non-blocking Vite chunk-size advisory only).
- Credit-only migration deploy: PASS on `credit_strategy_phase6_8_block` (PostgreSQL port 5433).
- Immediate branch CI: PASS — run `33591552069` on `fa57a751a41964729e6209c25ae38d3527f53071`.

## Acceptance reconciliation

| Requirement | Result |
|---|---|
| Newest intended report vs latest accepted authority | PASS |
| Eligibility has zero ledger mutation | PASS |
| Reserve, do not consume | PASS |
| Retry/concurrency/no overspend | PASS |
| Purchase/plan/no-credit handling | PASS |
| Atomic audit/outbox/work creation | PASS |
| Owner-scoped API and canonical client role | PASS |
| Client UI states and recovery paths | PASS |
| Historical migration preservation | PASS |

## Known limitations

- Reservation expiry is represented as a lifecycle hook but no background expiry policy is activated; cancellation is the implemented release path. A future canonical policy may set `reservationExpiresAt` and invoke the same append-only release semantics.
- Sprint 6.1 intentionally does not validate or accept report bytes, build the complete card portfolio, persist change declarations, or submit/consume the credit. Those remain bounded to Sprints 6.2–6.5.

## Boundary confirmation

- No Phase 7 work was started.
- The rapid branch was not merged into `ai-enabled`.
- Only the isolated Credit database `credit_strategy_phase6_8_block` was used.
