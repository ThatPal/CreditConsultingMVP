# POAR-D — Screen and Section Matrix

Legend: `C` content/function, `J` journey, `B` beauty, `E` ease. Every row is an authenticated route or canonical screen family at baseline `271f5f9`.

## Client

| Screen / route | Major sections and current evidence | C/J/B/E judgment | Severity / rebuild |
|---|---|---|---|
| PORTAL-01 `/app` | Welcome; current focus; Credit Center/Documents/Support shortcuts | Real but too sparse; no goal or lifecycle visual focal point | P2: client command-center hero + journey strip |
| PORTAL-02 `/app/journey` | focus; goal/profile/appointments; current cycle; history/future | Good facts, very long prose/cards; weak temporal scan | P2: navigable timeline with locked/active/complete semantics |
| PORTAL-03 `/app/plan` | focus; progress; guidance/actions/milestones | Complete but checklist-like; no dependency/trajectory visual | P2: milestone map, sticky next action, blocker detail drawer |
| PORTAL-04–08 `/app/credit-center/*` | overview; profile; report; analysis; history; plan/support links | Strong separation and honesty; facts lack scales/comparison/trends | P2: score bands, utilization gauge, bureau compare, history chart |
| PORTAL-09 `/app/credit-center/review` | state hero; progress; readiness | Clear state, but equal-weight panels and limited evidence preview | P2: stepper, document readiness, consultant handoff panel |
| PORTAL-10 `/app/readiness` | legacy readiness path | Function overlaps Review/Major Readiness vocabulary | P2: redirect or explicitly scope; remove conceptual duplication |
| PORTAL-11 `/app/cards` | KPI strip; catalog/applications; portfolio | Rich data; images absent, KPI hierarchy weak, page too long | P2: visual wallet, utilization ring, grouped timeline |
| PORTAL-12 `/app/cards/explore` | filters; governed results; research disclaimer | Honest but generic cards; no compare workflow | P2: gallery + compare tray + sticky filters |
| PORTAL-13 `/app/cards/wishlist` | saved research list | Route can transiently render blank; lacks cross-link to comparison | P1/P2: route recovery + shortlist workspace |
| PORTAL-14 `/app/cards/:productId` | product facts; disclosures; save | Fact-complete; no image-led product identity or portfolio-fit view | P2: product hero, terms table, compare/save rail |
| PORTAL-15 `/app/application-rounds` | cycle context; frozen goal/profile; current round | Clear but visually flat | P2: seasonal/cycle timeline and readiness visualization |
| PORTAL-16 `/app/rounds/:id` | overview; entitlement; profile; plan; major check; downstream states | **Contradicts populated Strategy/schedule/Live children** | P1 CPOAR-001: canonical lifecycle projection first |
| PORTAL-17 `/major-check` | explanation; choice; save/cancel | Honest and usable; radio-heavy, no impact summary | P2: scenario explanation + change summary |
| PORTAL-18 `/strategy` | approved version; sequence; preparation | Good prose; sequence lacks card imagery and visual ordering | P2: application sequence board/timeline |
| PORTAL-19 `/schedule` | appointment; sync state; cancel/join | Functional; calendar status is technical | P2: calendar/timezone composition + resilient join focal point |
| PORTAL-20 `/live` | presence; material check; sequence/result controls | Functional but shared/local state mixed in vertical stack | P2: split live workspace; CPOAR-006 |
| PORTAL-21 `/results` | totals; goal progress; applications | Honest zeros; lacks goal gauge/result visualization | P2: result scorecard + application timeline |
| PORTAL-22 `/follow-up` | actions; plan builder entry; back | Empty-state ownership unclear | P2: actionable lifecycle state |
| PORTAL-23 `/analysis` | deterministic totals; published interpretation/history | Correct separation; weak before/after visualization | P2: delta chart and evidence-linked narrative |
| PORTAL-24–28 `/major-readiness*` | intake; readiness; preparation; coordination; timeline | Real state but tabbed panels underplay risk/time | P2: readiness scale, restriction banner, coordinated timeline |
| PORTAL-29 `/goals` | primary goal; target; audience; preferences; review CTA | Complete form; long and dense on narrow screens | P2: autosave, progressive disclosure, goal preview |
| PORTAL-30 `/services` | catalog; terms; eligibility | Real governed catalog; product cards lack imagery/value comparison | P2: service merchandising with honest eligibility |
| PORTAL-31 `/services/active` | balances; entitlements; usage history | Technically precise, visually ledger-like | P2: credit wallet + expiry/usage timeline |
| PORTAL-32 `/services/history` | search/filter; purchase cards; pagination | Technical provider language leaks; long cards | P2/P3: compact receipt list + detail drawer; CPOAR-013 |
| PORTAL-33 `/checkout/:id` | provider-neutral checkout/status | Important action needs persistent price/terms/recovery rail | P2: two-column checkout + sticky order summary |
| PORTAL-34 `/documents` | upload; dropzone; filters; large library; actions | Good drag/drop, but 4,812px page and no persistent preview | P2: bounded table/gallery + preview drawer + sticky upload/filter |
| PORTAL-35 `/notifications` | mark all; category filters; long inbox | 4,369px; not an inbox workspace | P2: virtualized inbox, detail pane, saved unread context |
| PORTAL-36 `/support` | case list/conversation/composer | Route transiently blank in sweep; otherwise canonical support exists | P1 route recovery; P2 split conversation workspace |
| PORTAL-37 `/account` | personal data; privacy requests; histories | Functionally rich but 2,519px settings document | P2: settings IA, anchored sections, request timeline |
| PORTAL-38 `/account/security` | identity; devices; activity; reset | Good safety semantics; user-agent detail dominates | P2: device cards, risk cues, compact technical disclosure |

## Consultant CRM

| Screen / route | Major sections and current contract | C/J/B/E judgment | Severity / rebuild |
|---|---|---|---|
| CRM-01 `/crm` | workload, urgency, schedule, recent context | Operational data exists; lacks daily timeline and visual triage | P2: shift dashboard with queue/agenda split |
| CRM-02 `/crm/work-queue` | filters, claim state, items, paging | Integrity strong; needs multi-family saved views and keyboard flow | P2: dense queue grid + preview/action pane |
| CRM-03 `/crm/clients` | authorized search, filters, page state | Canonical scope enforced; needs richer scan fields and saved views | P2: virtualized directory and command search |
| CRM-04 `/crm/clients/:id` | identity/context, tabs, focus, related work | Real Client 360, but owning workflows break persistent context | P2 CPOAR-010: client context rail/workspace |
| CRM-05 `/plan` | plan editor, steps, publish/governed actions | Functionally real; form/card flow weak for dependencies | P2: autosaved outline + dependency canvas |
| CRM-06 `/cards` | client portfolio context | Useful but separate from catalog comparison | P2: portfolio-fit research workspace |
| CRM-07 `/strategy` | version, ordered applications, approval | High-value workspace expressed as stacked form | P2: sortable sequence board, compare tray, version diff |
| CRM-08 `/results` | factual outcomes | Good authority separation; weak result scan | P2: compact matrix + discrepancy flags |
| CRM-09 `/analysis` | deterministic facts, draft/publish/history | Needs evidence-linked analysis and before/after chart | P2: analysis canvas + approval rail |
| CRM-10 `/finalize` | completeness, finalization action | Governed but isolated from downstream impact | P2: finalization checklist + impact preview |
| CRM-11 `/major-readiness/:caseId` | readiness, preparation, decision/history | Authority strong; restrictions need persistent cross-workflow visibility | P1/P2: coordination command center |
| CRM-12 `/credit-center` | published client context | Useful read-only context; should remain alongside work | P2: dockable reference pane |
| CRM-13 `/reviews/:reviewId` | review detail shortcut | Route overlap increases navigation ambiguity | P2: converge with canonical workspace/deep link |
| CRM-14 `/reviews` | queue/filter/pagination | Real and deterministic; needs table density and previews | P2: bounded table + assignment/age visualization |
| CRM-15 `/reviews/:client/:review` | report/profile/analysis/publication workspace | Richest surface, but extremely card-heavy and long | P1/P2: resizable evidence/profile/analysis/approval panes |
| CRM-16 `/card-catalog` | research filters/results | Same client catalog grammar, insufficient consultant density | P2: expert comparison table + client fit sidecar |
| CRM-17 `/card-insights` | insights/approval | Real governance; no confidence/source visualization | P2: evidence lineage and diff approval |
| CRM-18 `/readiness` | generalized readiness | Conceptual overlap with specific workflows | P2: route to owned queue/domain context |
| CRM-19 `/support` | cases, assignment, messages, visibility | Real operations; needs split pane, SLA/urgency/timeline | P2: support workbench |
| CRM-20 `/sessions`, `/live-sessions` | session collection | Alias/duplicate IA; needs one calendar/live entry model | P2: consolidate IA |
| CRM-21 `/live-sessions/:id` | presence, sequence, outcomes, help | Integrity strong; needs shared-state visualization and shortcuts | P2: live command workspace |
| CRM-22 `/calendar` | schedule, filters, appointments | Functional; lacks true calendar density and agenda continuity | P2: week/day + agenda with timezone clarity |
| CRM-23 `/appointments/:id` | details, join, sync/recovery | Real but panel-like | P2: appointment dossier + live readiness rail |
| CRM-24 `/account` | profile/preferences | Adequate, generic | P3: compact staff preferences IA |
| CRM-25 `/account/security` | MFA/sessions/activity | Safety complete; device/risk hierarchy needs polish | P2: security center archetype |

## Admin

| Screen / route | Major sections and current contract | C/J/B/E judgment | Severity / rebuild |
|---|---|---|---|
| ADMIN-01 `/admin` | operational overview and shortcuts | Broad but card dashboard without trends/impact | P2: operations cockpit |
| ADMIN-02 `/users` | search/filter/paging/users | Real volume behavior; needs dense table/saved views | P2: identity operations grid |
| ADMIN-03 `/users/:id` | identity, roles, sessions, actions/history | Governed; related evidence scattered | P2: dossier with timeline and side action rail |
| ADMIN-04 `/access-grants` | temporary grants, scope, revoke | Authority correct; expiry/scope hard to scan | P1/P2: grant matrix + risk/expiry timeline |
| ADMIN-05–08 `/audit-events*`, `/security-events*` | lists, filters, details | Immutable evidence real; correlation/incident story missing | P2 CPOAR-008: event explorer/timeline |
| ADMIN-09–11 `/ai/jobs*`, `/ai/processes` | status, attempts, outputs, recovery | Operationally meaningful; needs DAG/latency/failure views | P2: pipeline observability workspace |
| ADMIN-12 `/sources` | governed URL/source management | SSRF controls strong; preview/provenance weak | P2: safe source preview + health/history |
| ADMIN-13 `/workflow-rules` | typed rules, versions/actions | Functional but configuration is form-centric | P2: rule builder + simulation/diff |
| ADMIN-14 `/notification-operations` | deliveries, retries, states | Real; lacks funnel/latency/provider breakdown | P2: delivery operations dashboard |
| ADMIN-15 `/integrations` | providers and status | Overview is a set of panels | P2: dependency map + configuration completeness |
| ADMIN-16 `/scheduled-jobs` | jobs, runs, controls | Needs timeline, next-run and failure clustering | P2: schedule board/run history split |
| ADMIN-17 `/system-health` | services/health/actions | No topology or trend visualization | P2 CPOAR-009 |
| ADMIN-18 `/retention` | policies, holds, runs | Safe behavior exists; impact hard to preview | P1/P2: retention simulator + affected-count preview |
| ADMIN-19 `/reports` | operational reports | Improved beyond raw JSON; still needs chart/export/drilldown system | P2: report canvas with accessible tables |
| ADMIN-20 `/settings` | typed settings/kill switches | Governed; needs effective-value diff and blast radius | P1/P2 CPOAR-016 |
| ADMIN-21–22 `/services*` | catalog product list/detail/version | Complete but configuration-heavy | P2: catalog workspace, version compare, preview |
| ADMIN-23–24 `/payments*` | search/filter/list, detail/refund/dispute/reconcile | Strong domain/history; needs money/status timeline and exception queue | P1/P2: commerce operations workbench |
| ADMIN-25–27 `/integrations/paypal|stripe|bofa` | health/config/capability boundaries | Honest provider differences; presentation nearly identical | P2: provider-specific capabilities and test-state panels |
| ADMIN-28 `/account` | staff profile/preferences | Adequate | P3: consistent staff settings |
| ADMIN-29 `/account/security` | MFA/sessions/security | Complete, generic | P2: security center archetype |

## Cross-screen requirements

- Every collection: explicit volume model, bounded height, sticky controls, deterministic paging/cursor, empty/loading/error/stale states, focus restoration.
- Every money/score/risk visualization: units, baseline, date, uncertainty/source and accessible table/text.
- Every governed action: before/after preview, authority and step-up explanation, consequence, idempotent result and audit link.
- Every lifecycle page: one canonical state projection shared by overview, navigation, CTA and deep links.
