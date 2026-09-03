# Sprint 11.2 — Credit Card Round, Entitlement & Preparation Gate

## Boundary

- Starting/report SHA from Sprint 11.1: `e5716f0`
- Implementation SHA: `9a14f6d9ca00a40cfd7222822525e7710126336a`
- Report boundary: the commit containing this report

## Delivered contract

- Added durable `CreditCardRound` ownership inside one client-owned active `ApplicationCycle`, bound to its immutable Goal snapshot, current published Profile/Review, current shared preparation Plan version, and one verified `CREDIT_CARD_ROUND` entitlement.
- The source fingerprint records Goal, Profile/Review, Plan, portfolio, recent application, available major-readiness context, and entitlement identity without copying shared Plan items.
- Round creation is a single consequential transaction: entitlement use, Round, idempotency result, audit, and outbox either commit together or all roll back.
- Selection honors `quantityGranted`/`quantityUsed`; the entitlement reaches `CONSUMED` only on its final granted use. Retry and double-submit converge on one Round and one entitlement effect.
- PORTAL-25 is functional at `/app/rounds/:roundId`, separating paid access from Profile, preparation, major-check, and future Strategy gates. Phase 12+ stages are concise locked states.
- Client reads are owner-scoped; consultant reads require canonical `client.read` authorization and client scope.

## Focused proof

- Real PostgreSQL failure injection after entitlement mutation proved zero partial Round or entitlement effects.
- Retry succeeded once; subsequent replay returned the same Round.
- Counts: 1 Round, 1 consumed entitlement effect, 1 `CREDIT_CARD_ROUND_STARTED` audit, 1 `credit-card-round.changed` outbox event.
- An incomplete shared Plan blocked readiness; completing the canonical Plan item removed only that blocker. A paid entitlement never implied Strategy readiness.
- Cross-client Round lookup failed closed.
- Focused API suite: 4/4 passed. PORTAL-25/26 web suite: 3/3 passed. API typecheck passed.

## Migration and foundations

- Uses the additive `20260903030000_seasonal_cycle_round_foundation` migration introduced for this continuous Phase 11 run.
- No Commerce ledger, provider, purchase, or historical payment identity was redesigned.

## Deviations and exclusions

- No dedicated mid-sprint CI was required because implementation composes the accepted entitlement contract and does not modify shared Commerce/provider/runtime foundations.
- Major-check submit belongs to Sprint 11.3. No `RoundStrategy`, candidates, sequencing, approval, appointment, live-session, application-result, or finalization behavior was introduced.
