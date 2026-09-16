# U1.5 — Client Core Experience Finalization

Status: engineering verification PASSED for the U1.5 supported-data/component-contract scope. Ready for product review; product acceptance remains with the user. U2 has not started.

Baseline: `0cc3c12546e4ce0f84dadee4206b41e95c4b676c`, clean and synchronized with `origin/codex/astra-production` before implementation. Work is confined to the independent Astra checkout and branch. Final validated implementation SHA: `ba5a56513e276cfbdb1a9b9f669c12eeb4d458b4`. This report is a documentation-only follow-up to that implementation.

## Governing scope

Read the complete [U1.5 build package](https://docs.google.com/document/d/1UcTlPKHFNAyZXQkLDiHJ1h-4oOdAg6HSVYYX1kHPqC0/edit), [context architecture](https://docs.google.com/document/d/1Q6Gb3EkdQ8iOzxxjctT3TW4N6OYGVYdHXe6nZE-UTUY/edit), [data dictionary](https://docs.google.com/document/d/1CZ_1wQDwzPIXhEU_zMbHuMwAhWhzHL8nUtky3b1a7wI/edit), and complete U1.5 amendments in the exact screens, component library, and coverage register. The final mobile hub/detail override governs. Private source caches remain ignored.

This is client presentation finalization within truthful current data and explicit future contracts. It is not a claim that U3 extraction, U4 canonical Plan migration, or the entire platform is production-ready.

## Delivered routes and components

- Primary Portal: Home, Journey, Credit Center, Cards, Services, Support. Goals are Journey-owned. Documents, notifications and account remain utilities; Round/Major flows belong under Services context.
- Credit Center: Overview, Profile, Report Details, Analysis, Plan and History. `/app/credit-center/plan` and legacy `/app/plan` use the same page and records. Mobile uses destination rows and full-page details with explicit hub return; normal back navigation restores hub position.
- Home is focus-led, with server-owned next step, Goal/Journey, conditional appointment, compact credit/Plan and meaningful service/activity context.
- Overview combines a bureau gallery, utilization, compact facts, approved observations, assessment, next step and evidence-to-Plan bridges. Profile uses factual disclosure; Report Details has account gallery/list/search/detail contracts and secure original access.
- Analysis presents approved consultant narrative in a continuous reading area. Optional published evidence and Plan relationships become direct contextual links; absent relationships are stated explicitly.
- Plan is one mixed roadmap with Action/Guidance/Milestone distinction, secondary completed work, conditional upcoming work and Maintain & Prepare phase. Existing responses, help, verification, dirty-navigation, timed refresh, failed-read write pause and conflict handling remain authoritative.
- History selects bureau/model and metric, retains missing observations as gaps, rejects incompatible comparisons, and preserves immutable report snapshots. Exact tabular values supplement charts.

File-level KEEP / RESTYLE / RECOMPOSE / REBUILD / RETIRE decisions are in the [worklist](U15_WORKLIST.md). Typed input contracts, field-level quality mapping and later owners are in [data contracts](U15_DATA_CONTRACTS.md).

## Acceptance gates

PASS below means implemented and verified for U1.5's supported-data/component-contract scope. It does not accept future source systems or substitute for product review.

| Gate | Result | Evidence / boundary |
| --- | --- | --- |
| Baseline and independent lineage | PASS | Clean pulled baseline; no parent/Sol checkout or database mutations |
| Preserve U1 engineering | PASS | API/domain unchanged; 139 baseline API tests; retained response/recovery tests and live browser reruns |
| Six primary destinations; Plan nested | PASS | App tests and desktop/mobile captures; old Plan links retained |
| Six Credit Center peers | PASS | Route tests and seven-route two-width browser run |
| Journey-first Goals | PASS | Navigation ownership and Home/Center/Plan Journey continuations |
| Mobile hub/detail and direct return | PASS | Five destination/back tests, live Profile/Plan scroll restoration and direct History return |
| Home state hierarchy | PASS | Ten-state production-projection fixture matrix; dominant next-step owner and CTA |
| Rich Overview | PASS with source limits | Actual partial data and supported contract captures; no fabricated range/model |
| Factual Profile disclosure | PASS with source limits | Gallery, utilization, collapsed fact sections and supported evidence contract |
| Report evidence browser | PASS with source limits | Account gallery/list/search/detail tests and both-width references; current DTO lacks structured accounts |
| Published Analysis and traceability | PASS with source limits | Exact supplied evidence/Plan link tests; missing links are not inferred |
| One integrated Plan roadmap | PASS with adapter debt | Mixed types, current focus, completed disclosure, conditional next work and Nurture phase; U4 owns point-attached decisions |
| Comparable immutable history | PASS with source limits | Model/definition guards, missing-series gaps, snapshot identity and supported/insufficient references |
| Shared data quality | PASS | KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE tests; invalid/missing never silently zero |
| Fact → Profile → Analysis → Plan authority | PASS | Published-only interpretation; factual adapter and relationship continuations |
| Relational wayfinding/no-action states | PASS | Scoped focus owner/CTA matrix, section links, contextual Support, explicit back including Plan load/error |
| Distinct screen compositions | PASS for engineering review | Guided Home, visual Overview, disclosure Profile, evidence browser, reading Analysis, roadmap Plan, analytical History; screenshots await product review |
| Responsive/accessibility | PASS for tested scope | 1440/390 checks, no overflow, headings, labelled controls, keyboard-capable galleries and exact chart values; not an exhaustive assistive-technology certification |
| New shared components/contracts | PASS | Credit Center feature directory; contract registry in U15_DATA_CONTRACTS |
| Explicit U3/U4 dependencies | PASS | Owners below; no parallel persistence or client PDF parser |
| Complete relevant build/regression | PASS | Full web 396/396; final focused 28/28; API baseline 139/139; all five packages build; lint/type/format/diff checks pass |
| Deterministic visual evidence | PASS | [Desktop/mobile index](../evidence/u15-review/README.md), 60-state matrix and actual-route captures |
| Final SHA and review stop | PASS | Implementation `ba5a56513e276cfbdb1a9b9f669c12eeb4d458b4`; this closeout is documentation only; U2 remains parked |

## Verification record

Final full web regression: **396 tests / 77 files passed**, serialized, 817.18 seconds. Final focused regression after the last presentation/comparability repairs: **28 tests / 4 files passed**, including two additional Analysis relationship tests. Counts overlap and are not summed as unique tests. All five packages build; root lint, final changed-file lint, TypeScript, formatting and diff checks pass. Baseline all-five-package build and **139 API tests / 15 files** passed; API/domain/schema sources are unchanged. Subsequent full web runs exposed outdated navigation/history assertions, which were updated for the intentional UI changes. One unchanged autosave-navigation test failed under parallel load and passed isolated; the final full run was serialized and passed. These earlier runs are not described as clean.

Browser evidence includes seven real local synthetic routes at two widths, a 60-state controlled read matrix using production projection functions, and six richer component references at two widths plus account detail/list/search/model interactions. Reference fixtures are explicitly labelled, private development entries outside the production bundle. The matrix represents controlled projections, not 60 persisted lifecycle transitions. Browser checks used independent sessions and blocked non-read requests after login.

Failed-read and timed-refresh recovery reruns preserved answers, paused writes on failed freshness checks, avoided metadata-only false prompts, and required review when the server's focus changed. Visual inspection repaired repeated coverage prose and an Analysis header contrast issue.

## Deferred capabilities and owners

| Owner | Remaining capability |
| --- | --- |
| U3 | Structured report/account/inquiry/negative publication, calculation coverage, score model/range/factors, stable comparable historical series, account-change events and richer published Finding evidence relationships |
| U4 | Final CreditPlan persistence and adapter retirement, canonical affected-item Decision relationships, source Finding/Goal/service links and phase history |
| U6 | Final service/Round/Live/Major/calendar source integrations behind preserved server workspace projections |
| U9 | Whole-product visual/copy qualification beyond this client-core slice |
| U10 | Production/provider delivery, performance and operational qualification |

No fake production credit data, duplicate canonical persistence, client-side PDF parsing, migrations, or provider/payment/email actions were introduced. No API authorization or client-safe projection boundary was weakened. Current unsupported data is unavailable/partial rather than replaced with reference values.

Stop for product review of this report and evidence. Do not begin U2 without the next user instruction.
