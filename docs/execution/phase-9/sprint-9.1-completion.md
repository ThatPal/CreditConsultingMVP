# Sprint 9.1 — Plan Data Model, Dependencies & Validation

## Boundary

- Starting SHA: `4b10c643278d9782d1f2941f25e8f3807521813a`
- Branch: `rapid/phase9-12-plan-cards-strategy`
- Implementation/report SHA: recorded by the sprint boundary commit.

## Delivered contract

- Added the canonical reusable `Plan` and immutable `PlanVersion` lineage instead of creating Review-, Nurture-, Post-Round-, or Major-specific task systems.
- Added typed `PlanItem` records for ACTION, GUIDANCE, and MILESTONE with distinct completion modes, ownership, client-safe wording, internal rationale, outcome schema, timing, stable identity, optimistic versioning, and execution state.
- Added governed alternative `PlanPath` membership, explicit `PlanDependency` ALL/ANY groups, and immutable structured `PlanItemOutcome` records.
- Added source Review/Profile/Goal version references and source fingerprints needed for later reconciliation.
- Added deterministic validation for missing/self/circular/cross-path dependencies, unreachable required items, invalid type/completion combinations, and duplicate active paths.
- Dependency truth is evaluated independently from display order.

## Proof

- Clean forward migration from all 44 accepted migrations to migration 45: passed.
- Linear graph and alternate-path validation: passed.
- Self-dependency, cycle, invalid completion mode, cross-path, unreachable item, and duplicate active-path rejection: passed.
- Reordering cannot satisfy a prerequisite; explicit completion state can: passed.
- Focused Plan validation: 1 file / 5 tests passed.
- Workspace typecheck: passed.

## Security and concurrency

The schema carries per-version optimistic concurrency and immutable lineage fields. Authoring routes are intentionally deferred to Sprint 9.2, where canonical capability, client scope, MFA approval, and conflict behavior are enforced at the HTTP boundary.

## Deviations and limitations

- Existing pre-Phase-9 `PlanAction` remains as a legacy projection used by Work Queue code; it is not the canonical Plan aggregate and is not extended as a competing system. Its eventual projection migration is limited to affected composition work.
- No full authoring or client execution UI was pulled forward.

## Scope confirmation

Sprint 9.2 authoring/approval, Sprint 9.3 client execution, Sprint 9.4 reconciliation, and Phase 10 card/catalog behavior were not implemented in this boundary.
