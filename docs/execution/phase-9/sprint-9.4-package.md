# Sprint 9.4 — Nurture & Plan Reconciliation — Repo-Local Bootstrap Package

## Outcome

Complete the shared Plan engine by integrating Nurture presentation and safe source-change reconciliation. Approved/completed history must remain intact; material source changes create stale/reassessment/delta behavior rather than silently rewriting a live Plan.

## Start

Begin only from the exact Sprint 9.3 boundary. Copy this package to `docs/execution/phase-9/sprint-9.4-package.md` before coding.

## In scope

- Nurture presentation/state tied to the active Plan/Journey without creating a separate task system.
- Source-version tracking against published Review/Profile, Goal and other currently relevant canonical sources.
- Material change detection that marks Plan/item/path state stale or needs-review according to scope; harmless display-only changes do not churn versions.
- Plan reconciliation service: preserve completed history; retain consultant-approved/manual content; identify impacted items/paths; produce explicit proposed delta/new version; consultant approves resulting changes before they replace current approved content.
- AI-assisted reconciliation may propose changes through durable AI runtime if canonically available, but manual deterministic reconciliation remains possible and AI never overwrites approved content.
- Supersession/version lineage from old approved Plan to replacement Plan. Historical client read remains available where canonical; old Plan becomes read-only.
- Journey/Home/Credit Center/CRM projections reflect Nurture/current Plan/stale state and useful next action without duplicating truth.
- StartNurture / EndNurture / SuggestNextCycle or canonical equivalents only to the extent Phase 9 owns them; do not implement Phase 11 Cycle start/resume behavior early.
- Realtime/Attention/notification semantics for meaningful stale/reassessment/consultant-review/client-action transitions.

## Reconciliation rules

Completed PlanItem history is immutable. Consultant-approved text/choices are not silently regenerated. A source change must identify what changed and which items depend on it. New versions/deltas are explicit. Active client execution pauses only where affected safety/readiness rules require it; unaffected historical data remains visible.

## Focused proof

- published Review/Profile or Goal material change marks affected Plan stale/needs-review;
- non-material change does not create unnecessary replacement;
- reconciliation preserves completed outcomes/history;
- approved/manual item is not overwritten by AI/regeneration;
- replacement Plan has explicit lineage/version and only becomes active through governed approval;
- old Plan is read-only and cannot accept new client outcomes after supersession;
- Nurture state and next action propagate across Portal/CRM/Journey in realtime;
- unauthorized/cross-client reconciliation denied;
- affected Block B + 9.1–9.3 regression passes.

## Phase 9 end gate

Create `docs/execution/phase-9/phase-9-end-of-run-gate.md`. Record 9.1–9.4 exact SHAs, migration/seed results, focused test counts, immediate 9.3 CI, final exact-head CI, and prove M4 at current scope: consultant builds/approves a structured Plan; client can execute/report outcomes/unable states and receive guidance/milestones; canonical records/realtime propagate; Nurture/reconciliation handles source change without silent overwrite.

## Stop

Do not start Phase 10. Return Phase 9 for review.

## Report

Create `docs/execution/phase-9/sprint-9.4-completion.md` and commit final sprint boundary before the phase gate/report commit.
