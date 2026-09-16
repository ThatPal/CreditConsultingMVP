# U1 batch 08 — Shared visual foundation and collection restoration

Baseline: `38135af`, independent `codex/astra-production`. U1 remains IN PROGRESS / NOT PASSED.

## Scope and authority

RESTYLE shared theme; KEEP existing response/recovery engine, semantic status labels and numeric tabular figures; RECONCILE collection presentation persistence. F08/F09 receive reference-slice progress, not cross-product closure. F10 cross-device saved views remains OPEN; session scroll offsets are not SavedView domain records.

Component-library FND-03–06, FND-09, FND-12 and FND-15 govern controlled typography, spacing, moderate geometry, restrained teal accent, 44px touch targets and reduced motion. U1.1/U1.8 require shared defaults before further screen composition.

## Changes

- Shared primary palette and CTA gradient use restrained teal. Headings use a controlled responsive scale, body text gains reading line-height, and ordinary buttons use moderate corners. Status chips retain pills. Button/icon-button default hit areas are at least 44px; explicit component overrides still need qualification.
- Reduced-motion rules now select elements and pseudo-elements globally. Previously bare media-query declarations did not apply duration overrides to descendants. Primary button hover no longer shifts its position.
- Collection restoration requires an explicit stable identity; display titles are no longer storage keys. Unscoped consumers remain usable without persistence. No legacy title-key migration because the original account/resource is unknowable.
- Portal Plan opts in using its globally unique client-owned Plan ID, publication version and selected view. Missing version disables restoration. Exact item URLs disable restoration so item focus/scroll remains authoritative. Other collection owners must supply equivalent account/resource/view identities before opting in; no generic title fallback.
- Scope changes preserve the outgoing offset and reset unseen scopes. Storage failure remains harmless. This is optional presentation state, not a workflow or authentication store.

## Evidence

Browser: synthetic accounts in isolated Chromium; user sessions untouched; non-read API requests blocked after login. Desktop 1440×1000 and mobile 390×844:

- `docs/evidence/u1-foundation-navigation/`: Home, no-profile Center, Plan and mobile primary/secondary navigation. Shared focus/count agreement; no horizontal overflow or page errors.
- `docs/evidence/u1-foundation-center/`: published Overview, Analysis and History; exact Review Support context and visible selected mobile section.
- `docs/evidence/u1-foundation-refresh/`: roadmap, exact-step view, saved response with storage blocked and guidance empty state. Reduced-motion computed transitions and 44px Plan navigation checked. Arrow keys preserve response focus/value; no submission.

Inspected Home desktop, Plan mobile and published Center mobile captures: less dominant page headings, readable line spacing, flatter reference sections and moderate controls. Existing Home hero and Center history/analysis remain distinct composition acceptance work; these captures do not establish final visual acceptance.

## Validation

All five packages pass `pnpm build`; root ESLint and diff whitespace checks pass. Focused web run: 26/27 passed, with one existing-style 5s execution timeout in PlanLiveUpdates during concurrent checks. Isolated diagnostic rerun (15s limit, no config change): PlanLiveUpdates + CollectionSurface 14/14 passed. PlanPages 9/9 and ClientProductCompletion 4/4 passed in the grouped run. Initial new storage tests caught an incomplete text replacement; corrected before successful rerun. All three browser scripts pass, including the final post-storage-change response check. No server/domain/schema changes, API restart or database mutation required.

## Remaining U1 gate work

1. Complete source/currentness/blocker/available-action contract and active Live/Major precedence behind explicit U3/U4/U6 removal boundaries.
2. Reconcile exact Home hierarchy/context and Credit Center readiness/currentness/global states; current foundation improvements do not make legacy content final.
3. Resolve final Decisions/Nurture read surfaces against available domain owners without turning response events or legacy periods into shadow business models.
4. Finish semantic token consumption, role-shell and light-work-plane qualification, reference loading/error/blocked/waiting/history coverage and accessibility/failure evidence.
5. Refresh findings/surface acceptance mappings and run the functional-truth, UI/UX and quality gates. Produce U1_COMPLETION_REPORT only when all pass.
