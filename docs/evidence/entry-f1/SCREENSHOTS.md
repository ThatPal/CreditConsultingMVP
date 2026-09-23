# ENTRY-F1 implementation screenshots

**READY FOR REVIEW** — actual disposable DB/API browser evidence, not approved design references.

Implementation: codex/entry-f1 @ 83a2e82b01610d2d9e1967b314f05bfd93331474. 32 PNG captures. Desktop viewport 1440×1000; mobile 390×844. Full-page image dimensions may exceed viewport height. Fixed navigation remains at its actual viewport position in full-page captures; it is not removed for evidence.

## ordinary-login-desktop

Ordinary entry; no Goal required

Route: /login. Actor: anonymous. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Ordinary entry; no Goal required](ordinary-login-desktop.png)

## ordinary-login-mobile

Ordinary entry; no Goal required

Route: /login. Actor: anonymous. Viewport: 390×844. PNG: 390×844. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Ordinary entry; no Goal required](ordinary-login-mobile.png)

## ordinary-registration-desktop

Ordinary account creation without a Goal

Route: /register. Actor: anonymous. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Ordinary account creation without a Goal](ordinary-registration-desktop.png)

## ordinary-registration-mobile

Ordinary account creation without a Goal

Route: /register. Actor: anonymous. Viewport: 390×844. PNG: 390×844. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Ordinary account creation without a Goal](ordinary-registration-mobile.png)

## public-saved-desktop

Saved draft with actual expiry and full summary

Route: /goal-intake. Actor: anonymous. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Saved draft with actual expiry and full summary](public-saved-desktop.png)

## public-saved-mobile

Saved draft with actual expiry and full summary

Route: /goal-intake. Actor: anonymous. Viewport: 390×844. PNG: 390×1313. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Saved draft with actual expiry and full summary](public-saved-mobile.png)

## register-with-goal-desktop

Optional saved draft; no application during signup

Route: /register?intake=%5Bredacted%5D. Actor: anonymous. Viewport: 1440×1000. PNG: 1440×1379. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Optional saved draft; no application during signup](register-with-goal-desktop.png)

## register-with-goal-mobile

Optional saved draft; no application during signup

Route: /register?intake=%5Bredacted%5D. Actor: anonymous. Viewport: 390×844. PNG: 390×1543. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Optional saved draft; no application during signup](register-with-goal-mobile.png)

## pending-intake-desktop

Own attached draft remains discoverable after Not now

Route: /app/goals. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Own attached draft remains discoverable after Not now](pending-intake-desktop.png)

## pending-intake-mobile

Own attached draft remains discoverable after Not now

Route: /app/goals. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×2247. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Own attached draft remains discoverable after Not now](pending-intake-mobile.png)

## decision-no-primary-desktop

Authenticated explicit decision, no current primary

Route: /app/goals?intakeClaim=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Authenticated explicit decision, no current primary](decision-no-primary-desktop.png)

## decision-no-primary-mobile

Authenticated explicit decision, no current primary

Route: /app/goals?intakeClaim=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×2608. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Authenticated explicit decision, no current primary](decision-no-primary-mobile.png)

## applied-desktop

Server-confirmed Goal resolution

Route: /app/goals?intakeClaim=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Server-confirmed Goal resolution](applied-desktop.png)

## applied-mobile

Server-confirmed Goal resolution

Route: /app/goals?intakeClaim=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×1912. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Server-confirmed Goal resolution](applied-mobile.png)

## decision-different-desktop

Current and saved Goal comparison

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Current and saved Goal comparison](decision-different-desktop.png)

## decision-different-mobile

Current and saved Goal comparison

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×3571. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Current and saved Goal comparison](decision-different-mobile.png)

## kept-desktop

Server-confirmed Keep with unchanged Goal version

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Server-confirmed Keep with unchanged Goal version](kept-desktop.png)

## kept-mobile

Server-confirmed Keep with unchanged Goal version

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×1868. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Server-confirmed Keep with unchanged Goal version](kept-mobile.png)

## public-stale-desktop

Second tab rejected at loaded revision; edits retained

Route: /goal-intake?intake=%5Bredacted%5D. Actor: public capability. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Second tab rejected at loaded revision; edits retained](public-stale-desktop.png)

## public-stale-mobile

Second tab rejected at loaded revision; edits retained

Route: /goal-intake?intake=%5Bredacted%5D. Actor: public capability. Viewport: 390×844. PNG: 390×1020. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Second tab rejected at loaded revision; edits retained](public-stale-mobile.png)

## decision-stale-desktop

Concurrent canonical edit requires a fresh explicit comparison

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Concurrent canonical edit requires a fresh explicit comparison](decision-stale-desktop.png)

## decision-stale-mobile

Concurrent canonical edit requires a fresh explicit comparison

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×3571. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Concurrent canonical edit requires a fresh explicit comparison](decision-stale-mobile.png)

## uncertain-retry-desktop

Actual commit with response loss; only exact retry offered

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Actual commit with response loss; only exact retry offered](uncertain-retry-desktop.png)

## uncertain-retry-mobile

Actual commit with response loss; only exact retry offered

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×1821. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Actual commit with response loss; only exact retry offered](uncertain-retry-mobile.png)

## retried-desktop

Exact retry returns original committed outcome

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Exact retry returns original committed outcome](retried-desktop.png)

## retried-mobile

Exact retry returns original committed outcome

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×2027. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Exact retry returns original committed outcome](retried-mobile.png)

## decision-matching-desktop

Matching values; confirmation creates no Goal revision

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Matching values; confirmation creates no Goal revision](decision-matching-desktop.png)

## decision-matching-mobile

Matching values; confirmation creates no Goal revision

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×3547. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Matching values; confirmation creates no Goal revision](decision-matching-mobile.png)

## expired-recovery-desktop

Authenticated recovery; no Goal mutation

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 1440×1000. PNG: 1440×1000. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Authenticated recovery; no Goal mutation](expired-recovery-desktop.png)

## expired-recovery-mobile

Authenticated recovery; no Goal mutation

Route: /app/goals?intake=%5Bredacted%5D. Actor: 8fb3b2fd-1f30-4564-8ef7-5375acafd6fc. Viewport: 390×844. PNG: 390×1864. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Authenticated recovery; no Goal mutation](expired-recovery-mobile.png)

## storage-blocked-handoff-desktop

Real public save in same-origin iframe; storage denied; top-level auth preserves capability

Route: /register?intake=%5Bredacted%5D. Actor: anonymous. Viewport: 1440×1000. PNG: 1440×1149. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Real public save in same-origin iframe; storage denied; top-level auth preserves capability](storage-blocked-handoff-desktop.png)

## storage-blocked-handoff-mobile

Real public save in same-origin iframe; storage denied; top-level auth preserves capability

Route: /register?intake=%5Bredacted%5D. Actor: anonymous. Viewport: 390×844. PNG: 390×1252. Commit: 83a2e82b01610d2d9e1967b314f05bfd93331474.

![Real public save in same-origin iframe; storage denied; top-level auth preserves capability](storage-blocked-handoff-mobile.png)
