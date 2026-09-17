# Shell reference correction — 2026-09-17

This visual correction supersedes the original UI-F01/UI-F02 screenshots. Re-inspected the approved embedded Global Client Shell and Credit Center Shell images directly before editing. UI-F03 content and all publication/domain behavior remain unchanged.

## Corrected

- Consistent angular Credit Strategy wordmark on desktop/mobile; outlined client navigation icons; integrated selected navigation edge and subdued glow.
- Desktop greeting and actual signed-in identity follow the reference hierarchy. No fictional user portrait or sample identity is used.
- Credit Center uses the reference's compact title/subtitle header composition and a bordered desktop Review-context block; no false history dropdown. Mobile Review context stays secondary to the icon/label/current-section navigation control.
- All More links and actions now share one row geometry. Settings and Sign Out no longer use a different Button/startIcon margin system. More's desktop chevron aligns at the right; mobile sheet has a handle, clear close control, and destination chevrons.
- More, Section, account menu, and notification panel use opaque dark-teal overlay surfaces derived from the Overview palette. Client avatar no longer uses the old purple treatment. Fine teal borders replace the accidental white responsive outlines.
- A two-value loading accessibility fix changes the visually hidden skeleton label from MUI's numeric `width: 1` (100%) to `width: '1px'` (and matching height), eliminating horizontal overflow while a lazy route loads. No loading/recovery behavior changed.

## Review screenshots

- [Desktop](desktop.png) / [full desktop](desktop-full.png)
- [Mobile](mobile.png) / [full mobile](mobile-full.png)
- [More open — corrected alignment](mobile-more-open.png)
- [Section selector open](mobile-section-open.png)

The remaining captures repeat the unchanged detail/lifecycle contexts to verify shell stability. They follow the same live-versus-controlled-fixture distinctions as the original UI-F01–UI-F03 evidence.

## Verification

- **42 targeted tests / 4 files passed:** ClientPortalNavigation, CreditNavigation, CreditCenterShell, RouteReadyBoundary.navigation.
- Typecheck and changed-file ESLint passed. Final web production build checked before committing.
- Browser: all seven More labels have identical measured horizontal positions; all icons align. Six-area navigation, active parent, mobile More/Section sheets, keyboard focus trap/return, Escape, browser Back, one settled H1, no horizontal overflow at 390–1440px, and no page errors passed. [Browser record](browser-results.json).
- No broad regression/API/domain suites run. No later feature started. Visual approval remains pending.

## Files changed

`layouts/PortalBrand.tsx` (new), `layouts/ClientPortalNavigation.tsx`, `layouts/AppShell.tsx`, `features/credit-center/CreditCenterShell.tsx`, `features/credit-center/CreditCenterNavigation.tsx`, `theme/portalSurfaces.ts`, and the two pixel dimensions in `components/common/Feedback.tsx`, all under `apps/web/src`; this evidence directory and the implementation-record cross-reference.
