# Sprint 11.1 — Start & Resume Seasonal Cycle

## Boundary

- Starting SHA: `7b86cf7ec4e95c37b8c1f70840d94abcf9f0fc62`
- Implementation SHA: `09b70eacd3650fec56a8610551904442955de9f8`
- Report boundary: the commit containing this report

## Delivered contract

- Extended the accepted `ApplicationCycle` aggregate with governed `PAUSED` state and pause/resume timestamps while preserving all historical cycle rows.
- Added `startOrResumeCycle` as an idempotent consequential command. It requires a current published `CreditProfileState`, a current primary Goal, and freezes one immutable `CycleGoalSnapshot` for a newly started cycle.
- Derived client-facing seasonal labels (`Winter`, `Spring`, `Summer`, `Fall` + year) rather than exposing numeric cycle labels.
- Resume revalidates current Profile/Review and refuses to inherit a Goal that materially changed after the frozen snapshot.
- Completing the Nurture handoff closes only the active Nurture period; shared Plan and prior history remain intact.
- Added audit + durable outbox effects and client-scoped realtime invalidation for accepted transitions.
- Added a usable seasonal entry/current-focus surface at `/app/application-rounds` with current Goal/Profile context, explicit blocked states, and start/resume/pause controls.

## Schema and migration

- Migration: `20260903030000_seasonal_cycle_round_foundation` (the Phase 11 additive migration; no reset or historical migration rewrite).
- Existing `ApplicationCycle`, `CreditJourney`, `CycleGoalSnapshot`, `CreditProfileState`, and Plan ownership were preserved.

## Focused proof

- `apps/api/src/phase11/phase11.integration.test.ts`: valid start, one snapshot, replay convergence, snapshot immutability, stale-profile resume denial, current-profile resume, and fail-closed cross-client behavior.
- `apps/web/src/pages/Phase11Pages.test.tsx`: stale-profile blocking and disabled start CTA.
- Focused result at implementation boundary: API 4/4 passed; web 3/3 passed; API and web typecheck passed.

## Deviations and exclusions

- The additive migration also establishes the durable Round/check tables consumed by the next internal Phase 11 boundaries so the run retains one clean migration. Sprint 11.1 does not activate Phase 12 Strategy behavior or Phase 15 decision authority.
- Credit Card Round behavior is accepted at the Sprint 11.2 boundary; major-check behavior is accepted at the Sprint 11.3 boundary.
