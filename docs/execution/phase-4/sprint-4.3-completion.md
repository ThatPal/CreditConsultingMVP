# Sprint 4.3 — Journey / Cycle / Nurture State Foundation

Package: Continuous Rapid-Build Contract & Codex Package  
Rapid branch: `rapid/phase4-5-client-commerce`  
Accepted base: `285a0e3d961ab7dacb4b761c65e35797b257550f`  
Boundary SHA: this completion-report commit

## Outcome

Sprint 4.3 is complete on the persistent Phase 4–5 rapid branch. It adds a canonical lifetime Journey, adapts the existing ApplicationCycle persistence as the canonical Credit Cycle record, preserves immutable goal-at-cycle-start facts, introduces bounded nurture and credit-profile state foundations, and serves the same deterministic current-focus projection to Portal and authorized CRM surfaces.

No Sprint 5.1 commerce, service-purchase, payment, or entitlement behavior was added. The rapid branch remains unmerged from `ai-enabled`; `main` and `baseline/current-non-ai` were not modified.

## Material implementation

- Schema/domain: `CreditJourney` (one per client), adapted `ApplicationCycle.journeyId`, `CycleGoalSnapshot`, `NurturePeriod`, and `CreditProfileState`, with explicit enums, relations, uniqueness, and indexes.
- Migration: forward-only migration `20260901173000_journey_cycle_nurture_foundation`; it preserves all historical migrations, creates one Journey for every existing Client, attaches existing cycles, captures available historical goal facts, and derives a conservative profile-state projection from accepted Reviews.
- Cycle reconciliation: **ADAPT**. `ApplicationCycle` and its accepted steps/applications are retained as canonical cycle persistence. No parallel `CreditCycle` table or competing lifecycle was created. The API/UI describe these records as cycles; the legacy `/application-rounds` workflow remains available for accepted behavior. Full Start/Resume lifecycle redesign is **DEFERRED** to Phase 11.
- Queries: stable `GET /api/v1/client/home`, `GET /api/v1/client/journey`, and scoped `GET /api/v1/consultant/clients/:clientId/journey` projections.
- Current focus: one pure deterministic resolver used by both Portal and CRM projections. It prioritizes an explicit active nurture period, then the active cycle’s canonical stage, then factual goal onboarding; it does not infer future work.
- Portal: PORTAL-01 home and PORTAL-02 lifetime journey now show current focus/action, factual goal, honest credit-profile/plan/appointment availability, a distinct current cycle, read-only history, and explicit non-guarantee language.
- CRM: CRM-04 Client 360 includes the same Journey/goal/focus/profile facts; CRM-05 operational journey context is exposed only inside the already governed Client 360 route.
- Review evidence: `prisma/review/sprint-4.3-scenarios.sql` is idempotent and provides current onboarding, historical cycle, completed nurture, and active-nurture scenarios in the persistent Credit-only block database.

## Authorization, privacy, realtime, and audit

- Client projections always derive `clientId` from the authenticated client principal; caller-supplied client IDs are not accepted.
- Consultant projection requires `CONSULTANT`, canonical `client.read`, and an effective assignment or unexpired/unrevoked grant through the shared `requireClientAccess` policy. Denials use the shared recorder and do not return cross-client details, counts, rooms, or deep links.
- Projection payloads are screen-oriented and omit internal notes, document contents, payment data, and other unrelated internals.
- Sprint 4.3 adds no new state-transition command. Therefore no artificial idempotency, audit, outbox, notification, or Attention side effects were invented. Existing ApplicationCycle commands retain their accepted audit/live-update behavior; new cycle creation now atomically attaches the Journey and immutable goal snapshot.
- Portal and CRM query the same authoritative projection. Realtime remains optional invalidation, never the source of truth.

## Verification

- Persistent database: `credit_strategy_phase4_5_block` on Credit PostgreSQL port `5433`; created from the accepted Sprint 4.2 database and migrated forward without reset.
- Migration deploy: **PASS**, 31 migrations discovered and Sprint 4.3 migration applied.
- API typecheck: **PASS**.
- Web typecheck: **PASS**.
- Focused current-focus/cycle tests: **PASS**, 4/4.
- Focused Portal shell and CRM Client 360 regression: **PASS**, 23/23.
- Broader incidental API run: 97/97 collected tests passed; two realtime suites were not collected because that accidental command omitted `REDIS_URL`. This is not counted as the focused gate.
- Broader incidental Web run: Sprint 4.3-relevant tests passed; one unrelated Support document-picker test timed out. The corrected exact focused run is the reported gate above.
- Changed-workspace lint/build: recorded after final execution below.
- Risk-based GitHub CI: initial run `33537587538` exposed a migration-order defect; the corrective run is recorded after the final branch push below.

## Requirement reconciliation

| Requirement group                                 | Status          | Evidence / boundary                                              |
| ------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| One lifetime Journey per client                   | PASS            | Unique `CreditJourney.clientId`; forward backfill                |
| Canonical base Cycle without competing truth      | PASS            | Existing `ApplicationCycle` adapted and Journey-linked           |
| Immutable cycle goal snapshot                     | PASS            | Separate `CycleGoalSnapshot`; created atomically with new cycles |
| Base NurturePeriod                                | PASS            | Explicit lifecycle/reason/time fields; no generic wait model     |
| Base CreditProfileState                           | PASS            | Lightweight state only; no fabricated published snapshot         |
| Deterministic shared current focus                | PASS            | Shared API projection and pure resolver                          |
| PORTAL-01 / PORTAL-02                             | PASS            | API-backed home and journey views                                |
| CRM-04 / CRM-05                                   | PASS            | Scoped Client 360 journey projection and shared rendering        |
| History vs current vs future semantics            | PASS            | Explicit grouping; future state is not materialized or inferred  |
| Client self-scope and consultant governed scope   | PASS            | Principal-derived client scope and canonical access middleware   |
| Atomic audit/outbox/idempotency for new mutations | N/A             | No new consequential mutation was added                          |
| Realtime convergence                              | PASS            | Shared query truth; existing invalidation remains optional       |
| Attention/notification creation                   | N/A             | No genuine new attention-producing transition in this boundary   |
| Synthetic review scenarios                        | PASS            | Idempotent Credit-only scenario SQL                              |
| Full Start/Resume workflow                        | NOT IMPLEMENTED | Explicitly Phase 11-owned                                        |
| Phase 5 commerce                                  | NOT IMPLEMENTED | Explicitly excluded from Sprint 4.3                              |

## Risks and deferred work

- Existing ApplicationCycle stages reach into later roadmap concepts. They remain for compatibility, but Sprint 4.3 does not claim those future workflows are complete.
- Older cycles with no historical Goal cannot receive a truthful goal snapshot; their projection says the historical snapshot is unavailable.
- `CreditProfileState` is intentionally a lightweight current-state projection. Phase 8 owns durable published credit-profile snapshots.
- Plan content, nurture content, strategy, scheduling, application execution, and commerce remain with their owning later phases.

## Final handoff

The exact final Sprint 4.3 SHA and GitHub CI URL/status are supplied in the task handoff after this report is committed and the rapid branch is pushed.
