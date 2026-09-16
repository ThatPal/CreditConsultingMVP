# U0 inventory acceptance

Gate reviewed 2026-09-15 on `codex/astra-production`, following checkpoint `38478c5d6e506035e99f2eb4acf5316e06bad43d`. **U0 PASSED for baseline reconciliation. U1 product acceptance has not passed.**

| Required evidence                                          | Result                                                                                                                       | Reference                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Reproducible branch/health and original failures           | Recorded install/typecheck/lint/build, broad tests and focused diagnoses; isolated database and provider boundaries explicit | U0_BASELINE; BATCH-U0-01/02                                        |
| Migration/clean seed state                                 | 69 finished migrations, checksum parity, clean isolated system seed                                                          | U0_BASELINE                                                        |
| F01–F24 current-code verification                          | Each finding has current paths, prior repair evidence, status and owning wave; no blanket production-complete claim          | ASTRA_FINDINGS_STATUS                                              |
| Every current route disposition                            | 120 declarations, exact props/guards/redirects, reviewed treatment/owner/wave/rationale; no heuristic fallback               | route-inventory; route-dispositions; Portal/staff reviews          |
| Every inventoried shared module disposition                | 47 modules with exported helpers, reviewed treatment, API/query discovery and desktop/mobile status                          | shared-component-inventory; shared-dispositions; shared review     |
| Missing final surfaces and duplicate/embedded destinations | Explicit Portal and staff matrices, including partial embedded implementations and compatibility obligations                 | PORTAL_SURFACE_RECONCILIATION; STAFF_SURFACE_RECONCILIATION        |
| Reference-slice truth gaps                                 | Current/final owners, duplicated derivations, stale counts/currentness and adapter removal waves                             | U1_TRUTH_MAP                                                       |
| Browser baseline                                           | Ten real synthetic-data desktop/mobile captures of Home/shell, Center no-profile/published, Plan and Action                  | U1_VISUAL_BASELINE; docs/evidence/u0-baseline                      |
| Inventory integrity                                        | Seven parser/disposition checks pass; new unknown components fail extraction/classification; scoped lint passes              | scripts/u0-route-parser.test.mjs; scripts/u0-dispositions.test.mjs |
| No intentional product changes in U0                       | Only baseline test/tooling corrections and inventory/reporting changes                                                       | BATCH-U0-01/02 and this checkpoint                                 |

Passing U0 means the starting point and migration decisions are explicit. It does not mean staff screens were visually requalified, historical Review selection exists, provider integrations are production-ready, or all broad tests were rerun after diagnostics. Preserve the exact limitations in U0_BASELINE. Runtime code changes begin only after this gate record.

Next: U1 final foundation, shared query/current-focus truth and Home → Credit Center → Plan → Action reference slice. The collection storage/keyboard defects identified in the shared review are part of U1 foundation. No U1 completion report or broad U2 implementation is justified yet.
