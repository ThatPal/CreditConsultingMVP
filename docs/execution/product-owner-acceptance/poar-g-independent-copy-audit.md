# POAR-G — Independent Written Content & Content UX Audit

Date: 2026-09-06  
Branch/head audited: `rapid/phase17-18-operations-public` at `c7b6f6fe855af30c8014efc6da23387bf97daaf2`  
Mode: audit only; no copy or product behavior changed

## Product-level judgment

**WRITTEN EXPERIENCE NOT YET PRODUCT-OWNER COMPLETE.**

The product contains many careful, honest statements and unusually good authority language. It generally avoids promising approval and frequently distinguishes published guidance from system state. The missing layer is a coherent content system: current truth, meaning, ownership, next action and consequence are not projected consistently across overview, detail, notification, queue and handoff surfaces. Too much primary copy sounds like an engineering invariant, while many empty and waiting states accurately describe absence without naming the owner or safe next step.

## Method

- Read POAR-A through POAR-G from canonical Drive and retained all five POAR-D repository reports as governing design/UX context.
- Reconciled all authenticated routes and major page sections with current source strings and accepted Client/Consultant/Admin browser evidence.
- Re-audited the populated client route set in the running Credit-only environment, including Review, Credit Center, Plan, Cards, Round, Strategy, Scheduling, Live, Post-Round, Major Readiness, commerce, Documents, Notifications and Account/Security.
- Searched current screen source for generic actions, internal invariants, status/provenance language, draft/published distinctions, technical provider language and recovery states.
- Evaluated every POAR-B journey plus the three POAR-D additions for arrival, state consistency, owner, transition, interruption, terminology and external-explanation dependency.

## POAR-F disposition matrix

| POAR-F | Disposition | Independent refinement |
|---|---|---|
| COPY-001 technical truth before meaning | CONFIRMED AND EXPANDED | `Only verified review state is shown`, `Future steps are not inferred`, and Plan prerequisite invariants are primary UI copy. |
| COPY-002 missing “why now” | CONFIRMED | Titles orient by noun but current lifecycle relevance is inconsistent. |
| COPY-003 waiting lacks owner | CONFIRMED AND EXPANDED | Round, Analysis and Follow-Up can say unavailable/none without identifying consultant/client/system ownership. |
| COPY-004 generic CTAs | CONFIRMED | `Open`, `Continue`, `Enable`, and `Complete` remain common; context must not be inferred from nearby cards. |
| COPY-005 unexplained statuses | CONFIRMED | Chips are humanized inconsistently and consequence is often separated from status. |
| COPY-006 truth distinctions | PARTIALLY CONFIRMED / REFINED | Review/Strategy/Major/Support contain strong distinctions; the system lacks a reusable, enforced label hierarchy across domains. |
| COPY-007 architecture prose | CONFIRMED | Plan Builder and scheduled-job descriptions explain implementation before operator purpose. |
| COPY-008 productive empty states | CONFIRMED | Empty states often explain absence, less often owner/prerequisite/creation path. |
| COPY-009 success states | CONFIRMED | Mutation confirmation frequently relies on refreshed data rather than a complete “changed/next” message. |
| COPY-010 error grammar | PARTIALLY CONFIRMED / REFINED | Shared recovery improved; messages such as “could not be loaded safely” still omit cause category and alternate path. |
| COPY-011 glossary | CONFIRMED AND EXPANDED | `Review`, `readiness`, `cycle`, `Round`, `session`, `credit` and `service unit` sometimes collide. |
| COPY-012 freshness | CONFIRMED | Published timestamps are good, but updated/checked/live/stale vocabulary is not systematic. |
| COPY-013 commerce leakage | CONFIRMED | Client saw `BOFA_MERCHANT SANDBOX`, `Terms version legacy`, `1 service unit(s)`. |
| COPY-014 financial anchors | CONFIRMED | Exact facts are shown safely, but meaning/scale/as-of context is uneven. |
| COPY-015 workspace micro-orientation | CONFIRMED | Dense workbenches have headings but insufficient “this pane / save / publish” guidance. |
| COPY-016 why-we-ask | CONFIRMED | Best in Major Check; less consistent in report dates, current balances, privacy and governed settings. |
| COPY-017 consequence-first dialogs | PARTIALLY CONFIRMED / REFINED | GovernedActionDialog is a good base; screen-specific effect/scope/in-flight/recovery content is uneven. |
| COPY-018 destructive permanence | CONFIRMED | Disable/revoke/expire/delete/execute require one canonical semantic contract. |
| COPY-019 notification meaning | PARTIALLY CONFIRMED / REFINED | Seeded client subjects are meaningful; operator streams still risk event-centric language and weak resolution ownership. |
| COPY-020 handoffs | CONFIRMED AND EXPANDED | CPOAR-001 proves handoff copy can contradict actual child state. |
| COPY-021 contextual disclaimers | CONFIRMED | Honest disclaimers repeat and compete with action; uncertainty should remain adjacent to the decision. |
| COPY-022 client-safe/internal | ALREADY SATISFIED IN PART | Strategy and Support label this well; extend the pattern to all professional workbenches. |
| COPY-023 Admin impact | CONFIRMED | Scheduled Jobs is strong; kill switches, sources, integrations and retention need equally complete impact language. |
| COPY-024 contextual Support prefill | CONFIRMED | Entry links exist; attached-context disclosure and response expectation are inconsistent. |
| COPY-025 narrow progressive disclosure | CONFIRMED | Long paragraphs remain present on narrow screens rather than collapsing to state + action. |
| COPY-026 casing/punctuation | CONFIRMED | Raw uppercase states and generated field labels still appear. |
| COPY-027 voice consistency | CONFIRMED | “Your consultant”, “the system” and passive voice vary without an ownership rule. |
| COPY-028 false certainty | ALREADY SATISFIED IN MOST HIGH-RISK COPY | The product is cautious; retain this strength while making ownership clearer. |

## Independent findings

| ID | Sev | Finding | Evidence / impact | Required content outcome |
|---|---:|---|---|---|
| CPOAR-COPY-001 | P1 | Lifecycle truth is not composed into one language projection. | Round says Strategy/scheduling/Live are unavailable while those child routes are populated. | Derive overview, CTA, notification and handoff strings from the same canonical projection. |
| CPOAR-COPY-002 | P1 | “Current focus” can be accurate but non-actionable. | Home says “Your verified current focus and the next honest step” then offers three equal `Open` actions; Plan says “Waiting for the next verified step.” | Name the object, owner, reason, and one action—or say no action is required. |
| CPOAR-COPY-003 | P1 | Blank route states have no written recovery contract. | Wishlist and Support transiently rendered no content during the route sweep. | Shell-level loading timeout/error copy must always preserve location and recovery. |
| CPOAR-COPY-004 | P1 | Staff draft/save/publish state is not persistently summarized. | Individual fields and buttons distinguish states, but long workbenches do not maintain a single save/publication sentence. | Persistent `Draft saved… / Not client-visible / Published v…` content rail. |
| CPOAR-COPY-005 | P1 | Governed actions do not share a complete result narrative. | Dialogs often explain the effect before confirmation, but success is inferred from refetch. | Confirm object, effective change, scope, audit record and any next owner. |
| CPOAR-COPY-006 | P2 | Client education is either missing or presented as guardrail prose. | Credit Center gives exact scores/utilization; adjacent copy stresses publication boundaries more than “what this means.” | Meaning first, source/as-of second, concise uncertainty adjacent. |
| CPOAR-COPY-007 | P2 | `Readiness` has multiple unqualified meanings. | Review readiness, cycle readiness, Major Readiness and legacy `/readiness` coexist. | Always qualify: Review decision, Round preparation, or Major application coordination. |
| CPOAR-COPY-008 | P2 | Completed status does not reliably explain what became possible. | Plan and Review show completion; transition into readiness/Round action is variable. | Every completion: result + newly available action + owner. |
| CPOAR-COPY-009 | P2 | Empty-state ownership is absent in post-Round surfaces. | “No follow-up actions exist yet” and “Your consultant has not published an analysis yet” omit whether the live session must end or who acts next. | State prerequisite, owner, notification behavior and safe return link; no invented ETA. |
| CPOAR-COPY-010 | P2 | Technical commerce nouns are primary client content. | Provider enum, sandbox, legacy terms and pluralization leak. | Service/amount/status first; processor/reference inside expandable payment details. |
| CPOAR-COPY-011 | P2 | Client-facing IDs are used as substitute names. | Credit Center history shows `Review 514adb17`. | Human version/date/change summary; full ID only in support/technical details. |
| CPOAR-COPY-012 | P2 | Live presence words do not explain operational consequence. | `Client away`, `Consultant away`, `WAITING_FOR_CLIENT` appear without a shared “applications remain paused/safe” sentence. | Presence + consequence + recovery behavior + last confirmed time. |
| CPOAR-COPY-013 | P2 | Client goal language shifts between “Build 0% APR credit”, “Zero apr credit”, and “Build available credit.” | Journey, Round and Goal surfaces render related goal concepts differently. | Canonical goal display formatter and frozen-snapshot qualifier. |
| CPOAR-COPY-014 | P2 | Admin effective state and configured state are not consistently distinguished. | Integration/settings screens use `Enable`/`Disable`; impact of existing/in-flight work varies by page. | `Configured`, `effective for new work`, `in-flight`, `last checked` vocabulary. |
| CPOAR-COPY-015 | P2 | Work Queue urgency is a label, not a reason. | Work items expose status/counts; “why now” and aging consequence are inconsistent. | Reason sentence, owner, age/source event and exact next action. |
| CPOAR-COPY-016 | P2 | Client 360 does not narrate cross-workspace continuity. | Context exists, but deep links do not consistently say what will remain open or where the user is going. | Persistent client/job sentence and destination-specific action labels. |
| CPOAR-COPY-017 | P2 | Auth interruption language under-specifies return recovery. | MFA/session recovery works after corrections, but copy does not always name saved destination and whether work was preserved. | “Verify to return to [safe named destination]; your submitted/saved state is unchanged.” |
| CPOAR-COPY-018 | P2 | Data/privacy requests need lifecycle language. | Account explains request types but not a consistent submitted→verified→reviewed→completed narrative. | Request status, owner, identity check, exclusions and next notification. |
| CPOAR-COPY-019 | P3 | Generated labels expose casing and grammar defects. | `annual Fee`, `purchase Apr`, `0 Review Credits`, `1 service unit(s)`. | Central label/quantity/financial formatter with sentence-case rules. |
| CPOAR-COPY-020 | P2 | “Safe” is used as an unexplained error adjective. | “could not be loaded safely” tells the implementation posture, not what happened or remained protected. | Name load failure; explain no change occurred; retry/alternate/support action. |

No P0 copy defect was found. The contradictions are P1 because they block reliable state understanding, but they do not instruct an unsafe financial/security action. No implementation exception was used.

## Strengths to preserve

- Client copy generally avoids approval, score-improvement, limit and timing guarantees.
- Published-only Credit Center language and AI advisory limits are explicit.
- Strategy and Support distinguish internal rationale/client-safe text and AI drafts.
- Major Readiness correctly frames coordination rather than lender approval.
- Scheduled-job manual enqueue copy is a strong model for truthful operational consequences.

## Acceptance conclusion

Copy must be designed with the state model and screen archetype in every D-wave. A final proofreading pass cannot repair inconsistent projection, ownership and handoffs.
