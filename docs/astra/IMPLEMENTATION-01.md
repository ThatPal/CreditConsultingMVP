# A1/A2 implementation pass 1

Started with the user's instruction to begin development on 10 September 2026. This is an implemented reference slice, not completion of A1, A2, or the production roadmap. Work remains isolated on `codex/astra-production`.

## Delivered behavior

- Home has a prominent next step and owner, a desired-credit-amount panel, and a compact supporting facts row. Removed the inferred completed-milestone rail and the misleading count of Plans labeled as actions.
- Home and the client Plan endpoint select the same published Plan/version. A separate newer draft cannot hide the published Plan. Visible path membership is applied before summarizing its actions. Counts distinguish unfinished actions, completed actions, and items awaiting verification; guidance and milestones are not actions.
- A blocked Round or stale strategy overrides legacy cycle-stage instructions. Stale Plans show consultant ownership. An available client step or pending verification takes precedence over stage fallback. Home no longer tells the demo client to review a sequence while the strategy is being updated.
- Credit Center uses explicit sections and ordered credit facts, displays all three bureaus, distinguishes missing values from zero, and separates report date from publication date. It does not invent a score model, quality band, or missing bureau score. Report preview uses the configured API origin.
- Client Plan uses a clear completed/stale/waiting focus and separates guidance, actions, and milestones in readable rows. Removed the five-item display-order diagram that implied dependencies. Stale or consultant-owned actions do not offer client completion controls. Cancelled steps are excluded from progress. Reduced-motion preference is respected by the step-scroll button.
- The Plan editor preserves saved purpose, source references, dependency edges (including ANY/group), paths, deep links, and outcome-schema fields. It no longer resets versions to 1 or rewires the graph to display order. Reconciliation uses actual published-review and goal-revision references and a consultant-entered reason, rather than incrementing an invented profile version.
- Source fingerprints normalize only the four source-reference fields. Comparing unchanged references does not create a replacement merely because the original fingerprint included draft content. Approval preserves completed steps and unlocks steps whose prerequisites were already completed in the replacement.
- Publication and Plan events invalidate the actual Credit Center, client Plan, builder, Home, and Journey query families. The existing `home` event domain is recognized. Unknown event domains do not break invalidation.
- Screen changes reset the old screen's scroll position in both the desktop main container and the mobile document. Query-only changes do not reset the screen; hash navigation is left alone.

## Next-step contract for this pass

| Condition, in precedence order | Owner | Destination |
|---|---|---|
| Current cycle's Round is blocked | Consultant | Round status |
| Current cycle's strategy is stale | Consultant | Round status |
| Published Plan is stale | Consultant | Plan |
| A visible client-owned Plan step is available/in progress | Client | Plan |
| Plan update awaits verification, with no available client step | Consultant | Plan |
| Active Nurture period | Client | Journey |
| Active cycle, none of the conditions above | Existing stage owner | Stage destination |
| Goal exists, no cycle | Consultant | Journey |
| No active goal | Client | Goal entry |

This improves the observed contradiction, but does **not** yet replace every Round/Major/live restriction check with one cross-domain decision service. Stage fallback remains a documented next task.

## Verification

- API TypeScript build and web production build pass. Web still reports the existing large-bundle warning; code splitting remains required.
- 13 focused API unit tests pass (Journey projection and graph validation).
- 12 focused web tests pass (Home, published Credit Center, Plan builder/client controls, realtime mapping). The save test uses a dependency opposite to display order and confirms the exact saved edge, sources, path, deep link, and outcome schema survive.
- 6 PostgreSQL integration tests pass in the isolated Astra database (Plan authoring, reconciliation, execution). Added assertions cover a newer private Plan not hiding the published Plan, unchanged sources being a no-op, and completed steps surviving replacement approval. Test records are scoped and cleaned by their existing suites. No demo reseed was performed.
- Browser: signed in as the synthetic client and inspected Home, Credit Center, and completed Plan at desktop and phone widths, plus Home/Credit Center at tablet width. Observed Home: consultant updating strategy, 0 remaining actions, 1 completed action. Observed Plan: 3 of 3 total steps complete. Observed scores: Experian 718, Equifax 711, TransUnion 724; utilization 38%; report 8 September and publication 9 September.
- Layout inspections used 1440×900, 390×844, and 768×1024 viewport overrides. Measured phone and tablet document/main widths did not overflow horizontally in the inspected states. This is not a full accessibility audit or a browser pass across every state.

## Continue without losing scope

1. Complete A1's remaining reference compositions and state coverage, including realistic actionable, waiting, stale, empty, and Nurture screens. Carry the calmer hierarchy and explicit ownership into the shared shell, consultant workbench, and live dock.
2. Finish A2's cross-domain next-action/restriction service and source-version contract. Numeric published-profile versions do not currently exist; new drafts leave those unknown values null. Add enforceable server-side source ownership/currentness and a proper source comparison before approval.
3. Finish Plan authoring: explicit graph editing, source diff and reconciliation preview, versioned title/purpose metadata, stale edit recovery without discarding local drafts, and outcome-schema-specific client forms. Generic outcome text is still insufficient. Editing a replacement draft must preserve execution history throughout save/reapprove, not just direct replacement approval.
4. Complete lifecycle and publication refresh through real worker events and two independent browser sessions. The current tests verify mapping and domain/database behavior separately; they do not establish every SSE delivery path.
5. Continue A3 onward from ROADMAP.md. Real report parsing, AI/provider execution, production email, payments, calendar/live operations, Admin completeness, security/operations qualification, and production launch are still open.

No deployment, push, merge into another version, real payment, or external client communication occurred.
