# POAR Rebuild D2 — Client Financial Understanding

## Boundary

- Branch: `rebuild/authenticated-product-poar`
- Accepted start: `bc7ce1f64b463d6df376eaf522443609c00e9d0f`
- Scope: Client Home, Journey, Credit Review/Credit Center, Credit Profile, Credit Report, Analysis, Goal, Plan, and History.
- Guardrail: every financial display is derived from a published profile, saved goal, approved Plan, or canonical journey record. No approval probability, predicted score movement, or lender outcome was introduced.

## Independent audit and disposition

| Finding      | Severity | Evidence before correction                                                                                                                | Disposition                                                                                                                                           |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPOAR-D2-001 | P1       | Credit Center rendered an unstructured `Object.entries(profile)` field grid and did not distinguish factual measures from interpretation. | Corrected with an intentional financial canvas, factual score band/utilization gauge, grouped measures, publication state, freshness, and provenance. |
| CPOAR-D2-002 | P1       | Journey used three equal cards and raw lifecycle labels; the current prerequisite was not visually dominant.                              | Corrected with a dominant current-state hero and responsive lifecycle rail derived only from canonical foundation state.                              |
| CPOAR-D2-003 | P1       | Plan actions omitted owner/timing in the client projection UI and long Plans lacked a bounded navigation decision.                        | Corrected with owner/timing copy, factual completion arc, dependency view, bounded action collection, waiting explanation, and sticky next action.    |
| CPOAR-D2-004 | P2       | Published Analysis was a flat explanation followed by equivalent cards, with a weak connection to Plan.                                   | Corrected with a guided-decision composition, explicit consultant publication status, bounded priority collection, and specific Plan CTA.             |
| CPOAR-D2-005 | P2       | Credit Report exposed a download link but did not explain how the document relates to Profile/Analysis or what to do when missing.        | Corrected with evidence-workspace composition, source method disclosure, preview wording, and productive recovery copy.                               |
| CPOAR-D2-006 | P2       | Goal offered a target editor without an available factual-progress visualization or downstream staleness consequence.                     | Corrected: progress appears only when canonical `currentAmount` and `targetAmount` both exist; provenance and replanning consequence are explicit.    |
| CPOAR-D2-007 | P2       | History displayed truncated internal review identifiers as primary supporting copy.                                                       | Corrected with a chronological publication timeline and current-versus-historical meaning; identifiers are no longer client-facing.                   |
| CPOAR-D2-008 | P2       | Empty Credit Center state named absence but did not identify owner, next safe action, or draft privacy.                                   | Corrected with a productive empty state, consultant ownership, safe Review CTA, and draft/publication distinction.                                    |

No newly discovered P0 issue remained. The existing Credit Review intake is already a mature guided, previewable, recoverable workflow; D2 preserved it rather than duplicating its domain controls.

## Screen acceptance matrix

| Surface                | Information/actions and journey role                                                                                         | Non-card composition and truthful visualization                                                                                         | Ease, content, responsive/accessibility                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Home                   | Canonical current focus, owner, goal, Profile, Plan count, appointment state, and Journey entry.                             | Guided-decision hero plus compact financial dashboard; saved target and counts only. Cyan focal gradient gives current work priority.   | Primary action precedes supporting navigation; narrow layout stacks in reading order; recovery retains D0 behavior.                     |
| Journey                | Review → Profile → Plan → Application Cycle readiness, current owner/action, real cycle/history records.                     | Responsive `LifecycleRail`; completed stages recede, current prerequisite is emphasized, unavailable future stages are locked.          | Horizontal-to-vertical transformation; direct current action; waiting copy states owner and whether the client must act.                |
| Credit Review          | Existing guided intake, report selection/preview, submitted/waiting/complete states and publication handoff.                 | Existing step/progress workspace retained because it already uses purposeful guided composition.                                        | Existing autosave/recovery, source preview, specific submission/recovery actions, keyboard form semantics preserved.                    |
| Credit Center Overview | Current published summary, recommendation, score/utilization/account facts, Profile/Report/Analysis/Plan/History navigation. | Luminous decision hero and Light Focus financial canvas; score band, utilization gauge, and metric hierarchy use only published values. | Persistent deep links, contextual Support, responsive grid, textual equivalents and explicit sources on every visual.                   |
| Credit Profile         | Score/source/date, utilization, balances/limits, counts, inquiries and derogatory facts when supplied.                       | Light Focus grouped financial hierarchy replaces raw equal cards.                                                                       | Human labels and money/percentage formats; provenance disclosure; columns collapse cleanly at narrow width.                             |
| Credit Report          | File/source/date, secure preview, relationship to published Profile and Analysis, honest missing state.                      | Evidence-workspace canvas rather than a database dump.                                                                                  | Preview opens without replacing Credit Center context; source details are progressively disclosed; missing-report recovery is explicit. |
| Analysis               | Consultant assessment, prioritized published findings, reasons, and Plan connection.                                         | Guided interpretation hero plus bounded priority collection. No invented scales.                                                        | Published/owner language, plain-language meaning, specific Plan action and contextual Support remain reachable.                         |
| Goal                   | Goal type/scope/target/preferences and permitted update action.                                                              | Large factual target with optional progress arc only when both stored operands exist.                                                   | Consequences of changing the goal are explicit; controls remain labeled and stack at narrow width; no predictive gamification.          |
| Plan                   | Publication status, factual completion, owner, prerequisites, timing, verification and help paths.                           | Progress arc, dependency map, bounded action collection, and sticky current action replace repetitive page flow.                        | Long-list bounding, preserved keyboard scrolling, specific CTAs, consultant/system waiting states, narrow sticky-action wrapping.       |
| History                | Current versus prior publications, dates, and preserved historical meaning.                                                  | Chronological `EventTimeline`.                                                                                                          | No UUID-first copy; the timeline is semantic text first and remains linear at narrow width.                                             |

## Cross-screen contract proof

- Home, Journey, Credit Center and Plan use the same canonical journey/Profile/Plan endpoints; no client shadow state was added.
- Credit Center’s Profile, Report and Analysis are all projections of the same current published Review.
- Analysis links directly to approved Plan actions; Plan’s status and owner determine the next action or waiting message.
- Goal mutation continues to use optimistic versioning and now states its possible downstream re-review consequence.
- History is explicitly reference-only and cannot visually override the current published Review.
- Published, reported, consultant-interpreted and system-calculated language is visually separated through the D1 content system.

## Verification

- Full Web suite: 29 files / 114 tests passed, including new factual financial-visualization and lifecycle projection tests.
- Relevant accumulated API suite: 70 files / 278 tests passed on the isolated Credit-only `credit_strategy_d2_ci` database. The one BullMQ test that timed out while sharing Redis database 0 with the running review worker passed 9/9 when repeated on isolated Redis database 14; no implementation change was required.
- Fresh-database proof: all 66 migrations applied and the canonical system seed completed before the API gate.
- D0/D1 route recovery, content foundation, accessibility and bundle behavior remained covered by the full Web suite.
- Full repository lint and typecheck passed. Production builds passed for Web, API, Worker, Runtime and Shared; the pre-existing Vite large-entry warning remains informational.
- Populated browser proof on the Credit-only review environment verified Home, Credit Center Overview/Profile/Analysis, Goal and Plan. The seeded Plan supplied the required honest no-action state after all three items were complete; Goal showed factual 62% progress from stored operands; Credit Center showed published score 718 and utilization 38% with textual source equivalents.
- Responsive behavior is encoded at the D1 primitives (single-column narrow lifecycle, wrapping navigation/actions and collapsing financial grids); keyboard/focus/reduced-motion behavior remains covered by D1 shared tests and semantic browser inspection.
- Exact-final-head GitHub CI: immutable result supplied at handoff.

## Acceptance

D2 preserves authority-safe published truth while making the client’s financial position, consultant meaning, ownership, and next action visually understandable without external explanation. D3, Phase 18, public-site and deployment work were not started; `ai-enabled` was not modified.
