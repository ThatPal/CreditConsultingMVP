# U1.5 product review evidence

All accounts and credit facts in captures are synthetic local review data. Rich structured component fixtures are labelled explicitly and are never production fallbacks. Browser checks use isolated sessions and block non-read API requests after synthetic login.

## Actual client routes

- [Home, desktop](home-1440.png): dominant server focus, Goal/Journey and compact snapshot composition.
- [Overview hub, mobile](overview-390.png): score gallery, utilization, partial coverage, assessment and destination rows.
- [Credit Profile, mobile](profile-390.png): shallow disclosure with headline facts and honest missing detail.
- [Report Details, desktop](report-1440.png): current digest limits and protected original report access.
- [Analysis, desktop](analysis-1440.png): coherent professional reading plane. Desktop main content scrolls independently; this capture shows its initial viewport.
- [Plan, mobile](plan-390.png): Credit Center context and one integrated roadmap.
- [History, desktop](history-1440.png): unavailable/non-comparable metrics remain explicit; no invented chart points.

Seven routes × desktop1440/mobile390 passed one-H1, no horizontal overflow and no page-error checks. Narrow details have Back to Credit Center and no six-tab strip. Mobile hub → Profile → hub and hub → Plan → hub restored prior scroll; direct History entry returned to the hub.

## Deterministic state matrix

[60-state results](../u15-reference-matrix/results.json): available, expired, waiting, stale, Major restriction, Live, paused Live, completed/no client work, scheduled appointment, and Maintain & Prepare across Home/Center/Plan × two widths. Fixture focus/count/blocker construction uses the production server projection functions; these are controlled read fixtures, not 60 persisted lifecycle transitions.

- [Home waiting](waiting-home-1440.png)
- [Home no client work](completed-home-390.png)
- [Plan actionable](available-plan-1440.png)
- [Maintain & Prepare](nurture-plan-390.png)

Existing U1 dirty-response browser scripts were rerun: failed timed read paused writes, retry preserved answers, metadata-only reads did not prompt, and changed timed focus required explicit update review while retaining the response.

## U3-supported contract references

These demonstrate pure component inputs that U3 must publish. They are distinct from the limited legacy production DTO.

- [Supported score/range and metrics](reference-overview-390.png)
- [Account detail full-screen mobile sheet](reference-account-detail-390.png)
- [Comparable history](reference-history-1440.png)
- [Incompatible model history](reference-incompatible-390.png)

Reference run exercised six component compositions at both widths, plus account detail/list/search and model switching. It checked overflow and browser errors. Component tests cover gallery controls, unknown/partial/NA/zero values, missing-series gaps, model/definition comparison guards, account search/detail and source references.

## Reproduction and limits

Committed tests live under `apps/web/src/features/credit-center/` and the existing Plan/route/recovery tests. Ignored local capture scripts are `.tmp/astra-runtime/u15-browser.mjs`, `u15-hub.mjs`, `u15-reference-browser.mjs` and `u15-reference-matrix.mjs`; the reference-only entry is `apps/web/.tmp/u15-reference.html`. These depend on the isolated Astra runtime and local synthetic accounts and are not bundled by the application build. No user browser session is reused.

Captures document current composition, not full production qualification or complete U3 extraction. See [data contracts and later owners](../../reconciliation/U15_DATA_CONTRACTS.md). Desktop captures show the initial independently scrolling main viewport; component reference captures include the full standalone component composition.

## Desktop/mobile capture pairs

| Scenario | Desktop | Mobile |
| --- | --- | --- |
| Home actionable | [1440px](available-home-1440.png) | [390px](available-home-390.png) |
| Home waiting | [1440px](waiting-home-1440.png) | [390px](waiting-home-390.png) |
| Home no client work | [1440px](completed-home-1440.png) | [390px](completed-home-390.png) |
| Overview current partial data | [1440px](overview-1440.png) | [390px](overview-390.png) |
| Overview supported contract | [1440px](reference-overview-1440.png) | [390px](reference-overview-390.png) |
| Credit Profile current | [1440px](profile-1440.png) | [390px](profile-390.png) |
| Credit Profile supported contract | [1440px](reference-profile-1440.png) | [390px](reference-profile-390.png) |
| Report Details current | [1440px](report-1440.png) | [390px](report-390.png) |
| Report Details supported contract | [1440px](reference-report-1440.png) | [390px](reference-report-390.png) |
| Account Detail supported contract | [1440px](reference-account-detail-1440.png) | [390px](reference-account-detail-390.png) |
| Analysis current | [1440px](analysis-1440.png) | [390px](analysis-390.png) |
| Analysis supported relationships | [1440px](reference-analysis-1440.png) | [390px](reference-analysis-390.png) |
| Plan active | [1440px](available-plan-1440.png) | [390px](available-plan-390.png) |
| Plan waiting | [1440px](waiting-plan-1440.png) | [390px](waiting-plan-390.png) |
| Plan stale restriction | [1440px](stale-plan-1440.png) | [390px](stale-plan-390.png) |
| Plan Maintain & Prepare | [1440px](nurture-plan-1440.png) | [390px](nurture-plan-390.png) |
| History current insufficient data | [1440px](history-1440.png) | [390px](history-390.png) |
| History supported comparable series | [1440px](reference-history-1440.png) | [390px](reference-history-390.png) |
| History incompatible model | [1440px](reference-incompatible-1440.png) | [390px](reference-incompatible-390.png) |

Hub/back behavior was rechecked after final navigation changes: Profile returned to scroll offset 2594 and Plan to 2938, within the 80px tolerance; direct History entry returned to Overview without depending on browser history.
