# UI-F04 — Credit Profile implementation evidence

Visual Review Status: READY FOR FINAL VISUAL REVIEW

Branch: `ui/credit-profile`, created from approved `ui/portal-shell-credit-center-overview` at `33610fa43c94b76f0018fa76972dd6b3847a3ab5`.
Implementation commit: `36a1b1fba53d2659cfd03edcec38a565f2b34db0`. Subsequent evidence-only commit replaces desktop full captures with expanded-viewport captures; application code is identical.

Canonical package: https://docs.google.com/document/d/1E8wm4B2cAxvVPg8UIPdPAhzODh1YmMI-wSne4U5tMA4/edit

## Implemented

Scoped light factual reading plane, one focal bureau score with button/swipe/arrow-key controls, expanded utilization, summary-visible independent disclosures, conditional attributed source factors, deep-link expansion/focus, and Report Details/Analysis continuation. Existing published read, currentness, historical fallback, shell, navigation and query invalidation are retained. No schema/API/publication changes or production fallback fixtures.

Source files: `CreditProfile.tsx`, `CreditData.tsx`, `ProfileUtilization.tsx`, `ProfileEvidence.tsx`, `CreditProfile.test.tsx` in `apps/web/src/features/credit-center/`, plus Profile-only integration in `apps/web/src/pages/PublishedCreditCenterPages.tsx`.

## Validation

- Targeted Vitest: **44 passed**, five files: CreditProfile, CreditExperience, CreditCenterShell, CreditNavigation, PublishedCreditCenterPages.
- `pnpm --filter @credit/web build`: passed (TypeScript + Vite).
- ESLint for all six changed source/test files: passed.
- `git diff --check`: passed.
- Browser: focal score keyboard selection; independent disclosures; deep link opens/focuses; inherited mobile Section menu has six destinations and restores focus; no overflow at 360/390/768/1199/1200/1440; no draft/internal fields exposed; stale snapshot retained; no browser errors. See `browser-results.json`.
- No full web regression, API suite, provider suite or domain matrix run.

## Screenshot ledger

All routes are `/app/credit-center/profile`. Populated captures use the isolated local synthetic client's actual published read. Fixtures are browser-response overrides only, with no database mutations. Full desktop/mobile captures use taller viewports to include the complete internal scrolling pane; width-based responsive behavior is unchanged.

| File | Viewport | State |
| --- | --- | --- |
| desktop.png | 1440×1000 | Current published Profile, partial summary coverage |
| desktop-full.png | 1440×2881 | Complete desktop Profile |
| mobile.png | 390×844 | Current published Profile |
| mobile-full.png | 390×3722 | Complete mobile Profile |
| desktop-disclosure-open.png | 1440×3192 | Accounts & credit mix open |
| desktop-partial-fixture.png | 1440×2801 | Partial/unknown fixture; supported zero, missing utilization/limit |
| desktop-stale-fixture.png | 1440×900 | Stale fixture; saved publication retained |
| desktop-no-review-fixture.png | 1440×900 | No-Review fixture; no empty fact stack |
| mobile-in-progress-fixture.png | 390×844 (873px full capture) | Unpublished Review in progress; no draft facts |
| mobile-section.png | 390×844 | Frozen UI-F02 Section selector open |

## Explicit U3 dependencies and reconciliation

The existing adapter returns published summary values with PARTIAL coverage; model/range are null, source factors empty, and accounts/inquiries/negatives null. Accordingly, production account-utilization rows and eligibility counts, normalized mix visual, opening-date timeline, affected-payment summaries, inquiry timeline/window, negative-item details, bureau-specific differences, provider factors and comparable score deltas remain unavailable until richer immutable publication fields exist. The component interfaces preserve a path for those structured fields; no raw domain-table joins or PDF parsing were added.

Available capacity remains unknown while balance/limit account coverage is unconfirmed. Its deterministic calculation requires matching known coverage. No fabricated score grade, on-time percentage, or utilization advice is shown. Post-report updates are not available through this Profile read and are not merged into snapshot facts.

Report Details currently has `accounts` and a combined `inquiries` evidence anchor, but no dedicated payment-history anchor. Payment continues to that existing evidence area rather than inventing a destination or modifying Report Details. Historical Review composition remains the frozen shell's safe History fallback.

UI-F01/UI-F02 and Overview source files are unchanged. Report Details has not been started. Final acceptance remains a human visual review.
