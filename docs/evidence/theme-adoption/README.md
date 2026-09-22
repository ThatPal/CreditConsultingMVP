# Approved theme adoption — September 22, 2026

Branch: ui/credit-profile. Base commit: e1a01af00f41a0bc83da230b603d3bd23e065b0f. Screenshots capture the local working changes after this base.

User approved the standalone theme preview for present use, with future changes to be reviewed on that page before app-wide adoption.

## Applied

Blue/violet-led dark palette, navy structural canvas, brighter selected navigation and button glow; teal-led light focus surfaces. Loading colors, overlays, mobile More, profile menu, shell borders and existing shared surfaces use the updated direction. Primary gradient endpoints were deepened slightly to maintain 4.5:1 white label contrast. No layout, route, data, publication, API or domain changes; preview example components/data were not imported into the app.

## Verification

38 targeted tests passed across theme contrast, client navigation, Credit Center shell and Profile. Browser checks passed for delayed session/credit loading, More/account menu, Profile/Overview/Analysis, mobile overflow and no script errors. An initial package-script invocation failed to apply test filters and was interrupted; targeted Vitest was then invoked directly. No broad-suite completion is claimed.

Desktop viewport: 1440x1000. Mobile viewport: 390x844. Existing synthetic local client data only.

- desktop-session-loading.png: /app/credit-center, delayed session
- desktop-credit-loading.png and mobile-credit-loading.png: /app/credit-center, delayed published Profile request
- mobile-more.png: /app/credit-center, More open
- desktop-account-menu.png: /app/credit-center, account menu open
- desktop-light-analysis.png: /app/credit-center/analysis
- desktop-overview.png: /app/credit-center, existing partial published data
- desktop-profile.png and mobile-profile.png: /app/credit-center/profile, existing partial published data

Future theme review workflow is documented in apps/web/reference/theme-preview/README.md. UI-F04 feature approval is separate from this theme approval.

Production web build and targeted ESLint checks passed.
