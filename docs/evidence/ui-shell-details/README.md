# Shell detail correction — 2026-09-17

Compared with the UI-F02 approved composition: restored the full-width secondary Review frame on mobile and formatted its authoritative publication date as a short month date. Desktop retains the compact right-aligned Review context. No nonfunctional dropdown affordance was added.

Restored the mobile active destination's mint top border and selected background, including More for utility destinations. Desktop client profile hover now uses 10px corners; mobile and staff profile geometry is preserved.

Changed application files:
- apps/web/src/features/credit-center/CreditCenterShell.tsx
- apps/web/src/layouts/ClientPortalNavigation.tsx
- apps/web/src/layouts/AppShell.tsx

Validation: 40 targeted tests across ClientPortalNavigation, CreditNavigation, and CreditCenterShell passed; TypeScript build check and targeted ESLint passed. Browser assertions passed for profile hover/menu, Review frame, active border, section menu, no overflow at five widths, and no page errors. Formatting corrected after check.

Evidence uses the local synthetic client and real existing published reads. No backend/publication or inner-content changes. Historical switching remains dependent on future supported contracts. Atomic publication remains explicitly deferred per the existing reconciliation record.

- desktop-profile-hover.png: 1440 × 1000, profile hovered.
- mobile.png: 390 × 844, Review frame and restored active border.
- results.json: targeted browser outcomes.

Awaiting visual review; no later feature started.
