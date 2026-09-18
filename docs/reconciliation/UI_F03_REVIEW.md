# UI-F03 requirements review and UI-F01 profile correction

2026-09-17 — branch ui/portal-shell-credit-center-overview. Overview is **not ready to freeze**. This pass reviews Overview and corrects only the desktop client profile composition; it does not redesign Overview or change domain contracts.

## Authority reviewed

Re-read the current UI-F03 package, including Sections 15–17 (these supersede its earlier draft/concept-only notices), and UI-F01 including its final shell decisions. Inspected both embedded visual references and implementation/screenshots.

- UI-F01: https://docs.google.com/document/d/11bipfEaiNFvAQaKaMK6OwUbSTBK8qeTQ6-APmyUrtXs/edit
- UI-F03: https://docs.google.com/document/d/1S4Fobq7s4L1vyg1yOlxN8RVKzhu9d07agolxdJdNutg/edit

## Overview findings

### Required visual adjustments

1. **Density and hierarchy:** the implemented Snapshot's two-column, large-value metric list and extra eyebrow rows stretch the first desktop row, leaving large empty Baseline/Findings panels. The approved composition uses compact metrics with icons and tighter headers. Preserve the baseline explanation; do not fill it with invented changes. Retain the approved three-module desktop row and semantic mobile order.
2. **Assessment surface:** the implementation uses a large light gradient panel for a short Overview summary. UI-F01 says to avoid light focus planes for orientation/dashboard views; UI-F03's approved assessment is a dark summary card. Use the dark summary treatment here, reserving the light reading surface for detailed Analysis. Do not fabricate a consultant photo or a positive classification.
3. **Visual encoding:** all published findings use the same generic icon, metrics lack icon support, and progress is a text block with a vertical rule. Improve metric grouping and known focus/waiting-state visualization using truthful semantics. Do not invent additional milestones just to reproduce the illustrative timeline.

### Functional/contract qualifications

- Known published values, unknown-versus-zero, first baseline, top-three findings/Plan summaries, published-only professional content, stale retention and Plan error/no-action behavior have targeted tests. This supports those behaviors; it does not establish full requirements acceptance.
- Existing legacy profile adapter supplies no scoring model/range or metric comparability metadata. Neutral score arcs and suppressed deltas are intentional. Current comparison rendering is tested with explicit model inputs, not demonstrated with live comparable publications.
- Comparison selection currently considers only the immediately preceding publication. Supporting the full 'eligible prior comparable snapshot' requirement needs an explicit eligibility policy/contract and tests; do not claim this complete. The current legacy adapter also cannot distinguish an unchanged comparable history from noncomparable history.
- Snapshot limitations are summarized generically. The target requires per-metric definitions/inquiry window and included/excluded utilization basis when available. Those details are not supplied by the current published projection; never invent them. Most metric links go to generic Profile rather than a matching detail destination; verify destination contracts before adding anchors.
- Governed findings importance, versioned server-selected message templates, detailed progress/next-condition fields, and Review eligibility/stage-specific CTAs are not fully represented in this compatibility slice. Current UI uses published array order, local deterministic banner copy, the existing current-focus object, and the owning Review route. These remain reconciliation gaps, not implied completed backend capabilities.
- Atomic Review/Profile/Analysis/Plan publication remains explicitly deferred by the user. Preserve existing publication contracts. Other missing target-contract capabilities should not be silently treated as separately approved deferrals.

## Profile correction completed

The prior desktop control was missing the reference's separator and dropdown affordance and had excessive line/padding height. AppShell now uses a desktop-only divider, compact two-line identity, avatar, and dropdown chevron with restrained 8px hover corners. Mobile remains avatar-only. Existing account-menu behavior is preserved. The authenticated initial is retained because the illustrative headshot is not client data.

Changed application file this pass: apps/web/src/layouts/AppShell.tsx. Earlier shell detail edits remain in the working tree.

Evidence: ../evidence/ui-profile-reference/desktop.png, desktop-profile-hover.png, mobile.png, results.json. Visual review is pending. No UI-F04/later work started.

Validation: 51 targeted tests across four shell/navigation/Overview model files passed. TypeScript, changed-file ESLint, formatting and diff checks passed. Browser checked desktop profile chevron/compact sizing/hover/menu, mobile Review frame and active nav border, section menu, five viewport widths without horizontal overflow, and no page errors. No broad regression suite was run.

## Overview visual correction completed — 2026-09-17

The subsequent user request authorized completing the Overview changes. CreditOverview.tsx now uses compact headers with keyboard-accessible provenance hints; a two-row icon metric grid; a dark consultant assessment summary; published-severity finding symbols; a no-action indicator; a current-focus marker/owner treatment; and tighter Explore cards. The desktop three-module rows and mobile semantic order remain intact. Published assessment text, scores, Plan items, query boundary, lifecycle decisions and domain contracts were preserved. No fabricated consultant identity, score range, comparison or future milestone was added.

The visual adjustment items above are implemented and await visual approval. Target-contract qualifications above remain explicit dependencies; this styling pass does not resolve or claim to implement missing backend capabilities. Atomic publication remains deferred by the user.

Evidence: [Overview correction captures](../evidence/ui-overview-polish/README.md).
