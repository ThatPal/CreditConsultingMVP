# Sprint 9.2 — Consultant Plan Builder & Client Preview

## Boundary

- Starting SHA: `6769053fba93b99318196990f9ef7ab5d9e2cc73`
- Implementation/report SHA: recorded by this sprint boundary commit.

## Delivered contract

- Added persisted manual Plan authoring, explicit typed items, governed paths/dependencies, validation, optimistic conflict rejection, and immutable version creation after approval.
- Added CRM-12 protected builder query/create/update/approve routes using canonical Review capabilities, client scope, and MFA step-up for approval.
- Added a usable desktop-first CRM Plan Builder with context/status, typed editing, presentation-only reorder, validation-safe save, client preview, approval, and loading/error/conflict feedback.
- Added a positively selected client-safe projection excluding rationale, hidden mechanics, provider/model/reasoning data, and protected fields.
- Approval atomically freezes/activates the version, unlocks graph roots, and records one audit and outbox/realtime invalidation effect.
- Manual authoring is the complete path; no dependency on AI availability was introduced. AI regeneration was not invented because no canonical Phase 9 Plan-generation process contract exists yet.

## Proof

- Plan authoring/validation integration: 2 files / 6 tests passed.
- Optimistic conflict rejects stale editor state.
- Approved version remains unchanged after a later draft is created.
- Client projection contains safe fields and excludes consultant rationale.
- Audit/outbox approval effects occur once.
- API and Web typecheck passed.

## Deviations and limitations

- AI proposal/delta controls remain unavailable rather than presenting synthetic functionality.
- Client outcome execution is intentionally deferred to Sprint 9.3.

## Scope confirmation

Nurture/reconciliation and Phase 10 card/catalog behavior were not pulled forward.
