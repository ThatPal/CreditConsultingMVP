# Sprint 9.1 — Plan Data Model, Dependencies & Validation — Repo-Local Bootstrap Package

## Outcome

Create the reusable canonical Plan domain and deterministic validation engine that all later preparation, Nurture, Post-Round and Major Readiness planning will use.

## Start

Begin from the Phase 9 package bootstrap commit on `rapid/phase9-12-plan-cards-strategy`. Copy this document to `docs/execution/phase-9/sprint-9.1-package.md` before coding.

## In scope

- Canonical Plan container/version/source references and lifecycle appropriate to draft/approved/active/superseded/completed states.
- PlanItem typed as ACTION, GUIDANCE or MILESTONE with client-safe title/body, consultant-only rationale where allowed, sort/display order separate from dependency truth, completion mode, owner/actor expectations, target/due timing where canonical, status/version/audit metadata.
- PlanPath and PlanPathItem for valid alternate paths/branches without duplicating Plan items unnecessarily.
- Explicit dependency/prerequisite edges and unlock conditions. Model AND/OR/path semantics only as canonically needed; do not encode executable free-form code.
- Deterministic validation for missing references, self-dependency, circular dependency, unreachable required items, invalid cross-path relationships, invalid completion mode/type combinations, impossible unlock conditions, duplicate active-path conflicts and invalid activation.
- Version/optimistic concurrency and immutable historical approved/completed versions.
- Queries/projections needed by later GetPlanBuilder and client Plan view, but no full authoring UI yet.
- Canonical domain events/audit/outbox/realtime foundations for Plan create/version/status changes where state becomes consequential.
- Authorization foundations: Consultant authoring capability + client scope; Client read only after approved/client-safe projection exists in later sprint.

## Completion semantics

ACTION may require client structured outcome, consultant verification, system verification or simple acknowledgement only where canonically allowed. GUIDANCE is informational/acknowledgement-oriented and must not masquerade as a domain action. MILESTONE is satisfied by governed condition/system/consultant verification; client cannot simply click it complete if its mode requires authoritative verification.

## Prohibitions

No generic task table replacing Plan semantics. No UI ordering as prerequisite enforcement. No free-form JavaScript/rule expressions. No separate Nurture/PostRound/Major plan models. No Phase 10+ card/catalog behavior.

## Focused proof

- clean forward migration;
- valid simple linear Plan;
- valid alternate path Plan;
- cycle/self-dependency/unreachable/invalid completion-type cases rejected;
- UI reorder cannot bypass prerequisite state;
- concurrent edit/version conflict fails safely;
- completed/approved historical version is not destructively rewritten;
- authorization/cross-client denial;
- domain/API typecheck, lint/build.

## Report

Create `docs/execution/phase-9/sprint-9.1-completion.md` and commit the implementation/report boundary before 9.2.
