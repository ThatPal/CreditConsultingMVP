# UI-F04 requirements reconciliation

Visual Review Status: READY FOR RE-REVIEW. Human approval has not been granted.

Branch: `ui/credit-profile`. Corrects the prior `2f02cc6` implementation in place; parent UI-F01/UI-F02 and Overview remain frozen.
Package: https://docs.google.com/document/d/1E8wm4B2cAxvVPg8UIPdPAhzODh1YmMI-wSne4U5tMA4/edit

## Reconciliation

- Sections 5/15: dark Profile structure restored. A scoped light score focus area sits inside the dark page; utilization, disclosures and relationship bridge retain the native dark theme.
- Sections 16/22/24/26: Scores and Revolving Utilization & Capacity stay expanded. Secondary sections are summary-visible independent disclosures; optional negatives/differences/factors are conditional. Missing optional facts have concise unavailable text, not invented empty counts. Deep links still expand/focus their category, including unavailable optional-category targets.
- Profile integration excludes the generic WorkspaceBlockers component. Waiting/restriction/domain workflow panels do not render in Profile, including unpublished states. No other screen's blockers were changed.
- Sections 28/30–32: one selected bureau/model; supplied range only; factual aggregate, balance, limit, valid capacity and basis; up to five eligible account rows; no grades or advice. Existing production adapter and backend contracts are unchanged.
- Ending bridge distinguishes Report Details evidence from Analysis interpretation.

## Data modes and boundaries

`apps/web/reference/credit-profile.fixture.ts` is deterministic, typed test/reference data outside the production entry graph. It supplies eight accounts (five ranked eligible revolving accounts, one excluded revolving account with missing limit, an installment and a mortgage), a source range/model, dated inquiries, negative evidence, a bureau difference and source factors. Capacity uses the same eligible-account basis as balance and limit. This demonstrates supported target component states without claiming the real API already supplies them.

`apps/web/reference/capture-credit-profile.mjs` uses Playwright interception of the Vite-transformed page module to inject that view model only into the reference browser session. It preserves the actual frozen shells and actual Profile components. No fixture hook, route, fallback or import was added to production code. Run from this workspace using PLAYWRIGHT_MODULE (module file URL), REFERENCE_EMAIL and REFERENCE_PASSWORD for the isolated synthetic account. Mutating API requests are blocked after login. Fixture strings were checked absent from the production bundle.

Production-compatible captures use the local synthetic client's actual published API response. Missing U3 account collections, score model/range/factors, precise calculation coverage, inquiries and negative/bureau detail remain unavailable. Available capacity stays unknown when account coverage cannot be confirmed. No PDF parsing, raw-table joins, database writes or architecture changes.

## Validation

- Targeted five-file suite: **47/47 passed** (CreditProfile, CreditExperience, CreditCenterShell, CreditNavigation, PublishedCreditCenterPages).
- Profile's eight tests rechecked after final copy/deep-link refinements: **8/8 passed**.
- TypeScript/Vite production build: passed. Changed source/test/fixture ESLint: passed. `git diff --check`: passed.
- Browser: production and full-data reference no-overflow checks at 360/390/768/1199/1200/1440px; focal score keyboard controls; independent disclosures; anchor expansion/focus; inherited six-destination mobile Section selector/focus return; no restrictions in Profile; five full-data account rows; no draft/internal exposure; stale snapshot retained; no page errors.
- Full web/API/provider/domain suites were not run.

## Screenshot ledger

All captures use `/app/credit-center/profile` on `ui/credit-profile`. Exact implementation/evidence commit is recorded per figure in the Google Doc. Full captures use taller viewports to include the app's internal scroll pane.

| File | Viewport | Data/state |
| --- | --- | --- |
| reference-desktop.png | 1440×900 | Typed full-data reference |
| reference-desktop-full.png | 1440×3099 | Complete typed full-data reference |
| reference-mobile.png | 390×844 | Typed full-data reference |
| reference-mobile-full.png | 390×4134 | Complete typed full-data reference |
| reference-mix-open.png | 1440×3536 | Typed reference, mix disclosure open |
| desktop.png | 1440×1000 | Production-compatible partial published data |
| desktop-full.png | 1440×2518 | Complete production-compatible partial view |
| mobile.png | 390×844 | Production-compatible partial published data |
| mobile-full.png | 390×3634 | Complete production-compatible partial view |
| desktop-partial-fixture.png | 1440×2394 | Additional unknown/zero response fixture |
| desktop-disclosure-open.png | 1440×2829 | Production-compatible account disclosure |
| desktop-no-review-fixture.png | 1440×900 | No published Profile response fixture |
| mobile-in-progress-fixture.png | 390×844 | Unpublished Review response fixture |
| desktop-stale-fixture.png | 1440×900 | Stale publication response fixture |
| mobile-section.png | 390×844 | Frozen mobile Section selector |

## Remaining contract dependencies

U3 must publish the richer immutable child facts and calculation coverage before the structured reference experience can populate with real client data. Historical composition continues to use the existing History fallback. Post-report updates and comparable prior-score data are not supplied by this read. Report Details still has no dedicated payment-history anchor; the existing evidence destination is retained. No work on Report Details was begun.
