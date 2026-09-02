# Sprint 6.4 — Changes Since Report

Status: COMPLETE

Branch: `rapid/phase6-8-review-golden-path`

Accepted Sprint 6.3 boundary: `23e4b22`

Implementation boundary: `afaf10a`

## Delivered outcome

- Added canonical `ClientUpdate` history with category, subject, effective date, details, source, provenance, Review linkage, and supersession state.
- Client-declared changes and platform-observed changes are distinct authorities. Saving client intake never overwrites platform observations.
- Account changes, recent applications, and material changes are reconciled from the existing intake into canonical update rows.
- Deterministic source keys make repeat saves idempotent. Removed declarations are superseded rather than deleted, preserving history.
- Added explicit `noChangesConfirmedAt`; “No material changes” is a positive persisted confirmation, not an inference from an empty array.
- Known current platform updates can prefill the Review UI while remaining visibly attributable to platform provenance.
- The change layer remains separate from the Sprint 6.3 card portfolio and never mutates uploaded report facts.
- Minimal financial-relationship evolution is representable through `FINANCIAL_RELATIONSHIP` without broad budgeting or bank-data scope.

## Schema and migration

- Migration `20260902080000_client_update_provenance` adds governed update category/source enums, canonical update history, relations/indexes, and explicit no-changes confirmation.
- All 39 migrations deployed successfully to the isolated Credit database.

## Verification

- Affected Review API + validation regression: **2 files, 23 tests passed**.
- Proof covers platform/client provenance separation, account/application/material declarations, exact repeat-save counts, preserved platform records, supersession, and no-changes confirmation.
- API typecheck: PASS.
- Web typecheck: PASS.
- Changed-file lint: PASS.
- Migration deploy: PASS on Credit-only `credit_strategy_phase6_8_block`.

## Acceptance reconciliation

| Requirement | Result |
|---|---|
| Canonical durable changes | PASS |
| Explicit no-changes confirmation | PASS |
| Source/provenance preservation | PASS |
| Known platform-change prefill | PASS |
| Safe financial-relationship representation | PASS |
| Separation from card portfolio | PASS |
| Report facts remain immutable | PASS |
| Retry-safe resave and history | PASS |

## Known limitations

- Platform observations appear only when another canonical workflow has recorded them; Sprint 6.4 does not invent changes from report parsing.
- Free-form `OTHER` details are bounded and treated as client declarations, not verified report facts.

## Boundary confirmation

- Sprint 6.5 submission/credit consumption is not included.
- The rapid branch was not merged into `ai-enabled`.
- Phase 7 was not started.
