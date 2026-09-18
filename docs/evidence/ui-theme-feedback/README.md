# Shared theme feedback correction — 2026-09-17

Fixed the remaining old structural colors in the shared theme tokens: canvas, cards, operational surfaces, dialogs, borders, selection and ambient gradients. Portal surface aliases now consume the same canvas/border/selection tokens. Skeletons use a restrained mint tint. The HTML canvas and browser theme color match before JavaScript initializes.

Changed files in this pass:
- apps/web/src/theme/designTokens.ts
- apps/web/src/theme/portalSurfaces.ts
- apps/web/src/theme/index.ts
- apps/web/index.html

These shared token colors also reach existing screens/components that consume them; no routes, business behavior or page layouts changed. Light focus-plane colors, semantic status colors and intentional secondary data accents are preserved. Code search also found intentional secondary illustrations on onboarding and card-type accents; those unrelated feature compositions were not redesigned.

Validation: five targeted loading/navigation/gradient-contrast tests passed; web production build (TypeScript and Vite), changed-file ESLint and diff checks passed. Browser verification used the synthetic local client with delayed read-only session and Credit Center requests, verified computed canvas/card colors, mobile overflow, menus, and existing light Analysis. No page errors. See results.json.

Screenshots:
- desktop-session-loading.png — authentication read pending.
- desktop-credit-loading.png / mobile-credit-loading.png — actual Credit Center read pending, shell retained.
- desktop-account-menu.png / mobile-more.png — shared overlays.
- desktop-light-analysis.png — existing light reading plane preserved.

No broad regression suite or API/domain changes. Visual review pending.
