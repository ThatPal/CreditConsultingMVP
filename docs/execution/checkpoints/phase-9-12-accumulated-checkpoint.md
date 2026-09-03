# Phases 9–12 Accumulated Engineering, Contract Completeness & Golden Path Checkpoint

Status: COMPLETE — READY FOR PRODUCT-OWNER REVIEW

Branch: `rapid/phase9-12-plan-cards-strategy`

Accepted starting head: `0a729d1f9bed15b997df0acf058b1c34443dab7a`

The audit and contract matrix was created before product-code changes. Full C912-01–C912-24 and Sprint 9.1–12.4 dispositions are retained in `phase-9-12-contract-matrix.md`.

## Consolidated correction

- Integrated Strategy preparation with the PostgreSQL durable AI runtime, deterministic validation, restart-safe output hydration, provenance, and honest manual fallback.
- Completed frozen Strategy context across Plan, entitlement, Profile, Review, Goal, Cards/current offers/approved insights, Wishlist, applications, Round, and major-check truth.
- Added Strategy-to-AI and application-to-candidate foreign keys in one additive migration; no historical migration changed.
- Revalidated exact fresh/current facts at approval and preserved immutable approved history plus supersession/staleness semantics.
- Proved approval rollback, replay, concurrent winner, and exactly-one audit/outbox/notification/Attention effects.
- Added positive client-safe Strategy and Cards DTOs, excluding consultant evidence, internal rationale, AI metadata, and internal execution rules.
- Completed CRM Strategy source, comparison, authoring, validation, ordering, rules, and explicit confirmation UX.
- Made outbox tests await Redis subscription readiness; isolated worker evidence avoids retained jobs from the live review worker.
- Corrected the review launcher to use `apps/web` as the Vite root, eliminating a browser-visible all-routes 404 despite a listening port.

## Verification

- Fresh Credit database: `credit_strategy_phase9_12_checkpoint`.
- Migration chain: all 50 migrations applied from zero; historical chain unchanged.
- System seed twice: 16 templates both runs, no duplicates.
- Demo seed twice: stable client `27f970a1-529a-4afb-896c-dde8392519d4` and stable scenario identities/counts.
- Web: 18 files / 87 tests passed.
- API: 54 files / 213 tests passed.
- Worker: 5 files / 12 tests passed using isolated Redis DB 15.
- Runtime: 1 file / 3 tests passed.
- Shared: no-test pass.
- Typecheck, lint, and production builds: passed for all workspaces. Vite emitted only the pre-existing chunk-size advisory.

## Review URLs

- Client: `http://localhost:5184/app`
- Plan: `http://localhost:5184/app/plan`
- Cards: `http://localhost:5184/app/cards`
- Rounds: `http://localhost:5184/app/application-rounds`
- CRM Strategy: `http://localhost:5184/crm/clients/3ff6fd53-5928-4f58-bc32-66025d2661f6/strategy`
- API health: `http://localhost:3007/api/health/live`

The restored review environment uses only persistent database `credit_phase9_12_block`. The branch remains separate from `ai-enabled`; Phase 13 was not started. Final pushed SHA and exact-head CI are supplied in the handoff.
