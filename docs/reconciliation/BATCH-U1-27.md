# U1 batch 27 — Shared Plan action and blocker projection

Baseline c1a9487. Independent Astra; U1 NOT PASSED.

workspace/affordances.ts adds typed availableActions and blockers to the shared read used by Home, Credit Center and Plan. OPEN_CURRENT_FOCUS is explicitly NAVIGATION. Plan completion and help entries are COMMAND affordances with exact Plan/version/item basis and requiresRevalidation=true. Eligibility comes from the existing clientItemAvailability selector; source fields are explicitly selected, never spread from domain rows. No new persisted state, lifecycle or execution endpoint is introduced.

Plan-wide read-only state and item-specific locked/pending-verification/help/form-configuration states have distinct scope. A malformed form suppresses completion while retaining help. Completed/cancelled items do not become blockers. Locked-step owner is null: the adapter cannot infer prerequisite ownership from status alone. It never assigns that work to the consultant by default. Missing Plan produces navigation only, without inventing a payment requirement. Major/Profile state does not impose a blanket ban on unrelated Plan responses.

## Evidence

- 55 tests pass across new affordance tests, workspace projection and Plan authoring/execution integration. Coverage includes client versus professional ownership, stale reads, completed/cancelled/locked/waiting/help states, malformed forms and exclusion of private diagnostic/rationale fields.
- Persisted execution fixture reads the workspace twice while a prerequisite is unmet. Each read omits the completion command and exposes the exact locked item; each actual command attempt rejects with PLAN_ITEM_LOCKED. Existing idempotency and completion/verification tests continue to pass.
- Integration asserts Center and workspace action/blocker agreement. Authenticated API3015 smoke after scoped restart confirms Home/Center/Plan arrays agree on actual synthetic account reads. No business mutations in the browser check; non-read requests blocked after login. Ready endpoint 200.
- All five packages build; root lint and diff checks pass. Existing pg concurrent-query deprecation warning persists; no new failure.

## Boundary and next work

This is the Plan-response portion of T3, not the final frozen query envelope. The UI retains its existing tested controls and per-item availability while the common API projection is introduced. Review/service/access affordances, source-owned dependency details, Major/Round blockers and full metadata/error envelope convergence remain to be reconciled. U3/U4/U6 adapter retirement boundaries remain intact. No new read-only projection authorizes a command or guarantees that submitted form data/version is valid.

Next T3 batch should extend only from existing scoped domain guards, then connect shared client-facing blocker presentation without duplicating focus or hiding unaffected work. T4 recovery, V1 final comparison, V3 remaining contrast/dialog coverage and V4 Decisions/Nurture disposition remain open. No U1 completion report.
