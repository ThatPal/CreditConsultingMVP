# Phase 9 — Shared Plan Engine — Rapid Development Run & Repo-Local Bootstrap Package

## Status

READY. This is the first phase using the new repo-local execution-document model. Drive remains the canonical product/specification source; this package exists only to bootstrap the repo-local execution files because ChatGPT's GitHub connector currently lacks write permission.

## Starting boundary

Accepted Block B head: `91a89d0f4d88ffd0786321e940529b768f60ac26`

Current accepted branch: `rapid/phase6-8-review-golden-path`

Before coding, locally fast-forward `ai-enabled` to the accepted head, then create `rapid/phase9-12-plan-cards-strategy` from that exact head. `main` and `baseline/current-non-ai` remain untouched.

## Repo-local bootstrap — first commit

Before implementing Sprint 9.1, copy this phase package and the four Sprint 9.1–9.4 Drive packages into the repository as Markdown:

- `docs/execution/phase-9/phase-9-rapid-development-run.md`
- `docs/execution/phase-9/sprint-9.1-package.md`
- `docs/execution/phase-9/sprint-9.2-package.md`
- `docs/execution/phase-9/sprint-9.3-package.md`
- `docs/execution/phase-9/sprint-9.4-package.md`

Commit these package files as the first Phase 9 branch commit. From that commit onward, Codex reads the repo-local package files first. If more canonical context is needed, Codex may read the authoritative Drive documents. Completion reports are written only in the repo.

## Source-of-truth rule

Drive = canonical product, business, architecture, UX and roadmap requirements. Repo = code-state-specific execution packages, corrections, checkpoint instructions, completion reports and audit evidence. A repo-local package may summarize/reference Drive but may not silently redefine canonical product behavior.

## Phase outcome

Create one reusable Plan system for preparation, Nurture, Post-Round and Major Readiness. A Plan is not a generic task list: it contains typed Actions, Guidance and Milestones; optional alternative paths; deterministic prerequisites/unlock rules; structured outcomes; consultant approval; client-safe projection; and source-version reconciliation.

## Authoritative canonical sources

- 07 — Technical Architecture & Database Design.
- 08 — API, Commands, Queries, Domain Events & Realtime Contracts.
- 09 — AI Processes, Pipelines & Decision Contracts, for AI proposal/delta boundaries.
- 10 — Authorization, Security, Privacy & Audit.
- 11 — Integrations, Infrastructure, Deployment & NFR.
- 13 — Detailed Screen & UI Specification, especially PORTAL-08 and CRM-12 plus Home/Credit Center/Journey projections.
- 14 — Development Roadmap / Phases / Sprints, Phase 9 and M4.
- Accepted Block B implementation and checkpoint report.

## Run model

Execute 9.1 → 9.2 → 9.3 → 9.4 continuously in one Codex run. Preserve a separate implementation/report commit boundary for every sprint. Do not return between ordinary sprints unless a mandatory stop condition is triggered.

## Sprint order

1. 9.1 — Plan Data Model, Dependencies & Validation
2. 9.2 — Consultant Plan Builder & Client Preview
3. 9.3 — Client Plan Execution & Structured Outcomes
4. 9.4 — Nurture & Plan Reconciliation

## Phase-wide rules

- One shared Plan engine; do not create separate ReviewPlan, NurtureTask, PostRoundTask or MajorTask systems.
- UI order never overrides dependency truth.
- A Plan may have one or more paths, but only governed active/available path state is client-visible.
- Actions, Guidance and Milestones have different completion semantics. Do not reduce all items to a generic completed boolean.
- Outcome-bearing actions update owning canonical domain records through typed commands; Plan state reflects that result rather than replacing the domain record.
- AI may propose Plan items/changes in 9.2/9.4, but consultant-approved content cannot be silently overwritten. Deterministic validation owns dependencies, readiness, completion and publication/activation rules.
- Internal rationale, hidden branches, AI confidence/reasoning and consultant-only notes never leak to the client projection.
- Every material Plan version references relevant source versions (published Review/Profile/Goal/etc.) so source changes can stale/reconcile the Plan.
- Completed history remains immutable when a Plan is superseded/reconciled.

## Risk-based testing

- 9.1: high domain-model risk—dependency/cycle/unlock/state/concurrency tests and migration proof; immediate CI if shared schema/runtime foundations materially change.
- 9.2: focused authoring/approval/client-safe projection/AI-delta/UI tests.
- 9.3: high consequential workflow risk—structured outcomes, exactly-once completion, domain-update transaction, realtime/Attention/idempotency tests and immediate CI.
- 9.4: focused stale/reconciliation/Nurture/version-history tests.
- Phase end: accumulated Phase 9 affected-domain gate plus final exact-head CI. Broad visual maturity remains deferred. Next larger engineering checkpoint is after Phase 12.

## Mandatory stop conditions

Stop if canonical documents conflict materially; the shared Plan model cannot support later Post-Round/Major use without shadow state; a high-risk invariant cannot be satisfied without redesign; a security/privacy issue appears; or implementation would require pulling Phase 10+ product behavior forward.

## Completion reports

Create only in repo:

- `docs/execution/phase-9/sprint-9.1-completion.md`
- `docs/execution/phase-9/sprint-9.2-completion.md`
- `docs/execution/phase-9/sprint-9.3-completion.md`
- `docs/execution/phase-9/sprint-9.4-completion.md`
- `docs/execution/phase-9/phase-9-end-of-run-gate.md`

Each records starting SHA, implementation/report SHA, delivered contract across schema/domain/API/UI/realtime/security, focused proof, deviations, known limitations and confirmation later-sprint scope was not pulled forward.

## Phase end gate

Prove M4 at Phase-9 scope: an authorized consultant can create and approve a structured Plan from a published Review; the client can view the client-safe Plan, act/report outcomes/unable states, wait on Milestones, receive Guidance, and have canonical domain results/realtime state propagate; source changes can stale/reconcile rather than silently rewrite approved/completed content. Run affected Block B regression, migrations, typecheck/lint/build and exact-final-head CI. Stop after Phase 9; do not start Phase 10.
