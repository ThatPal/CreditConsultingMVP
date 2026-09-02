# Sprint 9.3 — Client Plan Execution & Structured Outcomes — Repo-Local Bootstrap Package

## Outcome

Make PORTAL-08 a real client Plan execution surface. Clients can understand what is available now, act on eligible Actions, acknowledge Guidance, wait on Milestones, report structured outcomes or inability, and see realtime progression without bypassing prerequisites or replacing canonical domain records with generic task flags.

## Start

Begin only from the exact Sprint 9.2 boundary. Copy this package to `docs/execution/phase-9/sprint-9.3-package.md` before coding.

## In scope

- PORTAL-08 client Plan route and read projection from the latest approved/active client-safe Plan version.
- Clear grouping of available now / upcoming or blocked / completed-history as fits canonical UX; dependency reason shown in business language when blocked.
- ACTION execution based on completion mode: simple acknowledgement only where valid; structured outcome drawer where required; unable-to-complete flow with reason/context; consultant/system verification states where applicable.
- GUIDANCE acknowledgement/read behavior without pretending guidance is an external action.
- MILESTONE presentation and governed satisfaction; client cannot manually satisfy system/consultant milestones unless the completion contract explicitly allows it.
- Commands: CompletePlanItem / RecordPlanItemOutcome / ReportPlanItemUnable / ReportPlanItemComplete / VerifyPlanItem or canonical equivalents. Outcomes requiring domain mutation call typed owning-domain commands/transactions, then Plan state derives/advances from that result.
- Exactly-once/idempotent completion/outcome recording; optimistic version checks and stale Plan handling.
- Deterministic unlock propagation after valid prerequisite completion. UI order alone cannot unlock anything.
- Realtime invalidation/refetch across PORTAL-08, Home, Credit Center, Journey and CRM Plan Builder/Work Queue where existing composition contracts apply.
- Meaningful Attention/notification effects for consultant verification, client-blocked/unable states and newly available meaningful steps; avoid notification spam.
- Client-safe wording/statuses and mobile-friendly presentation.

## Security

Client only acts on own active published Plan and only allowed item actions. Hidden paths/internal rationale/consultant notes remain inaccessible even by direct API. Consultant verification requires capability + client scope. Cross-client IDOR denied.

## High-risk proof

- prerequisite-locked item cannot complete through API or UI;
- duplicate taps/retries produce one outcome/effect set;
- structured outcome updates owning canonical record exactly once where applicable;
- unable-to-complete creates governed state/Attention without falsely completing;
- system/consultant verification modes cannot be self-completed by client;
- completing prerequisite unlocks dependents deterministically and realtime without reload;
- hidden/non-active paths are not exposed;
- stale/superseded Plan rejects new execution safely;
- cross-client/unauthorized denial;
- client/consultant two-session realtime proof;
- immediate CI because this sprint introduces consequential client actions and exactly-once domain effects.

## Out of scope

Broad Nurture lifecycle/reconciliation — 9.4. Card/Cycle/Strategy-specific Plan outcomes beyond existing canonical domains — later owning phases extend the shared engine.

## Report

Create `docs/execution/phase-9/sprint-9.3-completion.md` with transaction/idempotency/realtime/authorization proofs and commit exact boundary before 9.4.
