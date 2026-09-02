# Sprint 9.2 — Consultant Plan Builder & Client Preview — Repo-Local Bootstrap Package

## Outcome

Make CRM-12 a materially usable consultant Plan Builder on top of the shared 9.1 domain, with typed editors, dependency/path authoring, client-safe preview, deterministic validation and consultant approval. AI may propose a Plan/delta but may not activate or overwrite consultant-approved work.

## Start

Begin only from the exact Sprint 9.1 boundary. Copy this package to `docs/execution/phase-9/sprint-9.2-package.md` before coding.

## In scope

- GetPlanBuilder query composed from current published Review/Profile, Goal, Journey/Nurture context and existing draft/approved Plan state.
- CRM-12 desktop-first authoring workspace with clear context, Plan status/version, item/path structure, validation summary and client preview.
- Add/edit/remove/reorder Plan items using type-specific editors for ACTION, GUIDANCE, MILESTONE. Reorder changes presentation only; dependency graph remains explicit.
- Dependency editor and path/branch authoring using governed structured controls, not code/free text execution logic.
- Item fields appropriate to type/completion mode, client wording, internal rationale, timing, verification/outcome requirements and deep-link/action context where already canonical.
- Deterministic ValidatePlan and approval-readiness results with exact blockers.
- Consultant approval/version freeze of a client-safe Plan projection. Later edits create a new draft/version rather than mutating approved history.
- AI proposal/delta integration through the accepted durable AI runtime only if the process is canonically defined. Manual authoring must always work when AI is unavailable. Regeneration produces proposals/deltas and never silently overwrites consultant edits or approved content.
- Client-safe preview positively selects safe fields and hides internal rationale, hidden branch mechanics, AI confidence/provider/model/reasoning and consultant-only notes.
- Authorization: Consultant capability + client scope; consequential approval may require step-up according to canonical security rules.
- Audit/outbox/realtime/Attention updates needed when Plan approval makes client action available.

## Out of scope

Client execution/outcomes — 9.3. Nurture reconciliation/supersession — 9.4. Card Catalog/Strategy — later phases.

## Focused proof

- create/edit/reorder without dependency corruption;
- invalid/circular/unreachable Plan cannot approve;
- client preview contains only safe fields/available path semantics;
- approved Plan version becomes immutable historical truth;
- later draft/version does not mutate approved version;
- AI unavailable still permits full manual Plan authoring;
- AI regeneration cannot overwrite consultant-approved or manually protected items;
- unauthorized/cross-client authoring/approval denied;
- CRM-12 loading/empty/error/conflict/validation/preview states covered;
- affected Review/Credit Center regression remains green.

## Report

Create `docs/execution/phase-9/sprint-9.2-completion.md` and commit the exact implementation/report boundary before 9.3.
