# APC Wave 6 — Whole Authenticated Product Acceptance & Accumulated Maturity Audit

Status: **COMPLETE — READY FOR PRODUCT-OWNER REVIEW**  
Recommendation: **AUTHENTICATED PRODUCT ACCEPTED**  
Branch: `rapid/phase17-18-operations-public`  
Accepted base: `91ba26ee6712e5b3ab2af6f9a2b6174be19e302e`  
Lifecycle fixture boundary: `b1799aef608dc54a1faf2178676f48aaad351c30`  
Acceptance correction boundaries: `37fb75f712edfc9de8abe0e2be8a4ff0f6d80cb1`, `0636425bb5b71e66869af9ab876d3141f7e38b12`, `7bd01083bd296ffe9f1ff763588ff152e322764c`

## Acceptance outcome

The authenticated Client, Consultant and Admin product is accepted for the completed Phase 1–17 scope. This recommendation does not claim public-site, deployment, Phase 18, or future-roadmap completion. It means the authenticated product now has deterministic authority-valid review data, coherent role-specific navigation, populated daily-work paths, honest failure states, protected consequential operations, and accumulated regression evidence appropriate to the current milestone.

The audit found no open P0 or P1 defect and no material P2 acceptance blocker. Two Wave 6 findings were closed: the lifecycle demo data was not complete enough to prove the joined Strategy → Appointment → Live → Post-Round → Major Readiness path, and the Journey projection hard-coded appointment availability despite canonical appointment state. A third P1 was found in code review and closed: the production Credit Profile Review purchase button could become enabled but had no navigation/action.

## Deterministic authority-valid lifecycle fixtures

The demo seed now creates and idempotently restores:

- a current active Cycle and Credit Card Round with an approved Strategy/version, candidate and application;
- a booked appointment attached to the approved Strategy and a LIVE supervised Application Session with current Client and Consultant presence leases;
- a separate completed historical Round, completed appointment, ended session, approved CreditApplication, completed Post-Round Follow-Up and approved immutable final RoundAnalysis;
- a current Major Readiness case with an approved `NO_RESTRICTION` decision and a newer unapproved reassessment draft, so Client and Consultant visibility boundaries can be reviewed together;
- deterministic `PAUSE` and `LIMIT` coordination cases for scoped directory clients without weakening the main golden path;
- corresponding Work Queue items, notifications and audit history.

The fixture is explicitly non-production and does not manufacture professional authority at runtime. Approved records are deterministic seed evidence for manual review; normal commands retain capability, scope, version, concurrency, audit and outbox enforcement. Re-running the seed preserves staff MFA unless `RESET_REVIEW_STAFF_MFA=true` is explicitly supplied.

## Wave 6 findings

| Finding     | Severity    | Disposition | Evidence                                                                                                                                                                                                                                                                                                          |
| ----------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAPC-W6-001 | P1          | Closed      | The prior demo state did not include a joined approved Strategy, Appointment, Live Session, completed Post-Round/Analysis and Major Readiness set. `setupDemo.ts` now creates both current and historical authority-valid scenarios and emits stable review identifiers. Double demo seed returned identical IDs. |
| CAPC-W6-002 | P2 material | Closed      | `/api/v1/client/home` and `/client/journey` always returned `appointment.status=NOT_AVAILABLE`. The projection now reads deterministic canonical Appointment state; focused tests prove BOOKED, COMPLETED and genuinely absent states.                                                                            |
| CAPC-W6-003 | P1          | Closed      | The production-only Credit Profile Review purchase action could be enabled with `checkoutAvailable=true` but had no handler or destination. It now enters the existing governed Services/Checkout workflow; no shadow purchase or direct entitlement path was added.                                              |

No additional P0 logging, credential, cross-client scope, Admin/Consultant authority, payment, credit/entitlement, immutable-history, AI-authority or Support-authority issue was found.

## APC-001–APC-053 accumulated disposition matrix

Every baseline finding was rechecked against current routes, implementation, focused tests, the accepted Wave reports and populated browser behavior. “Closed” below means the confirmed/refined finding is satisfied for the authenticated Phase 1–17 boundary; it does not erase its history.

| Finding | Final disposition                      | Owning evidence                                                                                                                |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| APC-001 | CONFIRMED → Closed                     | Wave 2 canonical grouped Admin navigation renders every authorized group.                                                      |
| APC-002 | CONFIRMED → Closed                     | Wave 2 canonical six-item Client primary IA; Plan is owned by Credit Center while the safe deep link remains.                  |
| APC-003 | CONFIRMED → Closed                     | Wave 2/Wave 4 single CRM Cards area and read-only consultant catalog research.                                                 |
| APC-004 | CONFIRMED → Closed                     | Wave 2/Wave 5 operational Admin grouping and contextual subroutes.                                                             |
| APC-005 | CONFIRMED → Closed                     | Wave 2 role-appropriate shell hierarchy and labels.                                                                            |
| APC-006 | CONFIRMED → Closed                     | Wave 2 RecordContext/page-context system; Waves 3–5 adopt it in heavy workspaces.                                              |
| APC-007 | CONFIRMED → Closed                     | Wave 4 persisted Plan hydration, typed authoring, dependencies, client-safe preview and source reconciliation.                 |
| APC-008 | CONFIRMED → Closed                     | Wave 3 Current Focus/path composition and item-owned typed outcome input.                                                      |
| APC-009 | CONFIRMED → Closed                     | Wave 4 persistent Client 360 header and seven-domain context rail.                                                             |
| APC-010 | CONFIRMED → Closed                     | Wave 4 populated monitoring dashboard and owning-workflow drill-down.                                                          |
| APC-011 | CONFIRMED → Closed                     | Wave 4 multi-family Work Queue triage, direct actions and authority-safe search.                                               |
| APC-012 | CONFIRMED → Closed                     | Wave 3 semantic published Credit Center and client-safe recommendation vocabulary.                                             |
| APC-013 | PARTIALLY CONFIRMED / REFINED → Closed | Wave 3 factual current/history continuity without invented future state.                                                       |
| APC-014 | CONFIRMED → Closed                     | Wave 3 governed card facets, portfolio facts, imagery and research-only Wishlist behavior.                                     |
| APC-015 | CONFIRMED → Closed                     | Waves 4–5 bounded catalog/insight operating collections and authority separation.                                              |
| APC-016 | CONFIRMED → Closed                     | Wave 2/Wave 5 content cleanup; implementation IDs remain diagnostics, not primary copy.                                        |
| APC-017 | CONFIRMED → Closed                     | Wave 3 construction-era client Round copy removed; subsequent role sweeps preserved it.                                        |
| APC-018 | CONFIRMED → Closed                     | Wave 4 grouped client slots and recoverable Consultant calendar/appointment workspace.                                         |
| APC-019 | CONFIRMED → Closed                     | Wave 1 typed error classification plus Wave 2 shared RecoveryState adoption.                                                   |
| APC-020 | CONFIRMED → Closed                     | Wave 5 understandable period-controlled reports replace raw JSON.                                                              |
| APC-021 | CONFIRMED → Closed                     | Wave 5 human labels/effect summaries with technical detail secondary.                                                          |
| APC-022 | CONFIRMED → Closed                     | Wave 5 shared GovernedActionDialog covers consequential Admin operations.                                                      |
| APC-023 | CONFIRMED → Closed                     | Wave 1 targeted authorized realtime refresh, reconnect catch-up and revocation checks.                                         |
| APC-024 | CONFIRMED → Closed                     | Wave 4 Consultant three-zone Live workspace; Client remains simpler/mobile-first.                                              |
| APC-025 | CONFIRMED → Closed                     | Wave 1 item-keyed typed Post-Round drafts; Wave 4 sustained operating context.                                                 |
| APC-026 | CONFIRMED → Closed                     | Wave 4 Post-Round workspace, editable Analysis/version history and explicit finalization.                                      |
| APC-027 | CONFIRMED → Closed                     | Wave 4 sustained Major Readiness assessment/decision/reassessment workspace.                                                   |
| APC-028 | CONFIRMED → Closed                     | Waves 3–4 semantic Client Major Readiness state, preparation and timeline.                                                     |
| APC-029 | CONFIRMED → Closed                     | Wave 3 state-driven Round lifecycle hub.                                                                                       |
| APC-030 | CONFIRMED → Closed                     | Wave 3 approved client Strategy preparation and scheduling handoff.                                                            |
| APC-031 | CONFIRMED → Closed                     | Wave 5 typed/versioned AI process and model-profile operations.                                                                |
| APC-032 | CONFIRMED → Closed                     | Wave 5 governed notification template/delivery-policy operations.                                                              |
| APC-033 | CONFIRMED → Closed                     | Wave 5 source governance, validation, safe URLs and operational state.                                                         |
| APC-034 | CONFIRMED → Closed                     | Wave 5 scheduled-job operations, result history and governed execution.                                                        |
| APC-035 | CONFIRMED → Closed                     | Wave 5 typed settings/kill-switch effects with step-up and audit.                                                              |
| APC-036 | CONFIRMED → Closed                     | Wave 5 category/health-oriented integrations and payment gateway ownership.                                                    |
| APC-037 | CONFIRMED → Closed                     | Wave 5 readable immutable Audit/Security investigation surfaces.                                                               |
| APC-038 | CONFIRMED → Closed                     | Wave 1 bounded domain realtime architecture and local-state live refresh.                                                      |
| APC-039 | CONFIRMED → Closed                     | Wave 2 adaptable server-backed collection navigation; owning waves apply it by context.                                        |
| APC-040 | CONFIRMED → Closed                     | Wave 2 shared record/context/dialog patterns; owning waves use them for high-value actions.                                    |
| APC-041 | CONFIRMED → Closed                     | Wave 5 bounded create/review/revoke access-grant lifecycle.                                                                    |
| APC-042 | CONFIRMED → Closed                     | Wave 5 high-volume user/access/session operations with human role language.                                                    |
| APC-043 | PARTIALLY CONFIRMED / REFINED → Closed | Wave 3 honest tracked Data & Privacy request through canonical Support.                                                        |
| APC-044 | PARTIALLY CONFIRMED / REFINED → Closed | Wave 3 notification categories, unread/history paging and deep links.                                                          |
| APC-045 | CONFIRMED → Closed                     | Wave 5 payment/refund/dispute/reconciliation operating views.                                                                  |
| APC-046 | CONFIRMED → Closed                     | Waves 2/5 unified Payments & Gateways hierarchy and provider-aware detail.                                                     |
| APC-047 | CONFIRMED → Closed                     | Wave 2 foundation and Wave 5 broad GovernedActionDialog adoption.                                                              |
| APC-048 | CONFIRMED → Closed                     | Wave 2 shared status vocabulary, adopted across Waves 3–5.                                                                     |
| APC-049 | CONFIRMED → Closed                     | Wave 2 authorized, debounced, bounded CRM global client search.                                                                |
| APC-050 | CONFIRMED → Closed                     | Wave 2 urgent/live shell affordance and Wave 4 Work Queue/Live continuity.                                                     |
| APC-051 | CONFIRMED → Closed                     | Waves 3–4 safe Client Review recovery and sustained Consultant Review workspace.                                               |
| APC-052 | PARTIALLY CONFIRMED / REFINED → Closed | Canonical route registry owns reachable product surfaces; legacy parallel exports do not create competing navigation or state. |
| APC-053 | CONFIRMED → Closed                     | Wave 2 shared visual/workspace primitives plus role-specific Waves 3–5 composition.                                            |

## CAPC-001–CAPC-023 accumulated disposition matrix

| Finding  | Final disposition                               | Owning evidence                                                                                                            |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CAPC-001 | BLOCKED BY PRODUCT DECISION → Accepted boundary | No issuer URL is invented. Product-owner D1 keeps provider handoff unavailable until a governed allowlisted source exists. |
| CAPC-002 | PARTIALLY CONFIRMED / REFINED → Closed          | Wave 1 session-row serialization and compare-and-set proofs.                                                               |
| CAPC-003 | CONFIRMED → Closed                              | Wave 4 persisted Plan draft hydration.                                                                                     |
| CAPC-004 | CONFIRMED → Closed                              | Wave 5 Settings loading/error/last-confirmed-state recovery.                                                               |
| CAPC-005 | CONFIRMED → Closed                              | Wave 3 canonical ID-scoped Card detail endpoint.                                                                           |
| CAPC-006 | CONFIRMED → Closed                              | Wave 4 Calendar/appointment recovery and mutation feedback.                                                                |
| CAPC-007 | CONFIRMED → Closed                              | Wave 2 staff notification reachability and honest failure behavior.                                                        |
| CAPC-008 | CONFIRMED → Closed                              | Wave 0 HTTP-boundary redaction, retained-log containment and regression proof.                                             |
| CAPC-009 | CONFIRMED → Closed                              | APC-2 bounded MFA repair and actual browser enrollment; preserved through double seed.                                     |
| CAPC-010 | CONFIRMED → Closed                              | APC-2 Work Queue API prefix repair and populated browser route.                                                            |
| CAPC-011 | CONFIRMED → Closed                              | Wave 4 lifecycle filtering moved before pagination.                                                                        |
| CAPC-012 | CONFIRMED / REFINED → Closed                    | Wave 1 complete Review document/job/output/artifact fixture and typed recovery.                                            |
| CAPC-013 | CONFIRMED → Closed                              | Wave 5 governed scheduled-job runner and operations.                                                                       |
| CAPC-014 | CONFIRMED → Closed                              | Wave 5 representative workflow evaluator with versioned/exactly-once effects.                                              |
| CAPC-015 | CONFIRMED → Closed                              | Wave 5 preview-bound safe retention with protected categories and holds.                                                   |
| CAPC-016 | CONFIRMED → Closed                              | Wave 2/Wave 5 invalid Admin-to-CRM audit links removed.                                                                    |
| CAPC-017 | CONFIRMED → Closed                              | APC-2 Admin routing repair preserves strategy denial while allowing Admin operations.                                      |
| CAPC-018 | CONFIRMED → Closed                              | Wave 5 payment collection query state includes search/filter/page.                                                         |
| CAPC-019 | CONFIRMED → Closed                              | APC-2 platform catalog capability routing and all-role proof.                                                              |
| CAPC-020 | CONFIRMED → Closed                              | Wave 4 Major Readiness projects current draft and approved recommendation separately.                                      |
| CAPC-021 | CONFIRMED → Closed                              | Wave 1 Live Help creates/reopens the canonical duplicate-safe Work Item; Wave 4 completes UX.                              |
| CAPC-022 | PARTIALLY CONFIRMED / REFINED → Closed          | Wave 1 token-owned outbox claims, non-overlapping polls and expired-lease recovery.                                        |
| CAPC-023 | CONFIRMED → Closed                              | Wave 2 registered, safe System Health destination.                                                                         |

## CAPC-W1–CAPC-W5 accumulated disposition

All wave-local findings remain closed or intentionally classified:

- `CAPC-W1-001` and `W1-002` are closed; `W1-003` remains an environment-only historical-volume note and was not used as acceptance evidence.
- `CAPC-W2-001` through `W2-007` are closed. `W2-008` was completed through the owning Waves 3–5 vocabulary adoption.
- `CAPC-W3-001` through `W3-003` are closed, including decimal normalization and realistic Cards/Wishlist fixtures.
- `CAPC-W4-001` through `W4-009` are closed, including the former P0 Work Queue scope/search composition defect.
- `CAPC-W5-001` through `W5-009` are closed, including staff-MFA seed preservation and Admin platform-catalog authorization.

## Browser acceptance

The actual Codex browser was used against the persistent Credit-only review environment, including the current 440px narrow viewport; desktop and breakpoint behavior was additionally covered by the accumulated responsive component suite. The audit did not use empty-screen existence as proof.

### Client

Populated paths verified: Home/Journey, Credit Center overview/Profile/Analysis/History/Plan, Cards/Explore/Wishlist, current Round → approved Strategy → scheduling → LIVE session, historical Results → typed Follow-Up → approved Analysis, Major Readiness, Notifications, Documents, contextual Support, Account and Security/Sessions. The LIVE page showed authoritative `LIVE` state, both participants present, pre-live confirmation, session messaging and connected supervision. The current and historical rounds were visibly distinct.

### Consultant

Populated paths verified: Dashboard → Work Queue → Review; global client search → Client 360; client Plan; Strategy; Calendar → Appointment → Live; Live Help → Work Queue; Post-Round → Analysis/finalization; Major Readiness draft/approved/reassessment; Support; Cards research; Account/Security. Client scope, Consultant capability and Admin-only boundaries remained fail-closed. Narrow-width CRM retained navigation, record context and owning actions.

### Admin

Populated paths verified: Dashboard, Users/Staff, Access Grants, Audit/Security, Services, Payments/Gateways, Card Catalog/Insights, AI Jobs/Processes, Sources, Workflow Rules, Notification Operations, Integrations, Scheduled Jobs, Retention, Reports, Settings/Kill Switches and System Health. Consequential dialogs were opened and cancelled without destructive execution. Expired step-up was presented as a recoverable protected state rather than weakened. Operational Reports contained semantic metrics/tables rather than raw JSON.

## Security, integrity and failure acceptance

- Role, capability, client-scope and temporary-grant denial tests remain green.
- Staff MFA remains QR-first, seed-stable and required for protected CRM/Admin access; no bypass was introduced.
- HTTP log redaction, safe metadata rendering and credential containment remain intact.
- Live commands retain session ownership, optimistic concurrency, idempotency, audit/outbox atomicity and reconnect catch-up.
- Outbox delivery retains per-claim ownership, retry/dead-letter behavior and expired-lease recovery.
- Payment operations retain original-provider routing, exact-once paid effects, refund/dispute/reconciliation and rollback/retry proof.
- Support/AI Support remain assistive only and cannot mutate Review, Strategy, execution, Round finalization, Major Readiness, payments/credits/entitlements or security authority.
- Loading, empty, denial, stale/conflict, session-expiry and retry states were rechecked across representative Client, CRM and Admin surfaces.

## Migration, seed and accumulated verification

Fresh gate database: `credit_strategy_apc_wave6_gate_20260907` on the Credit PostgreSQL service.

- Migration chain: 66/66 migrations applied from zero.
- System seed: twice, green and idempotent.
- Demo seed: twice, green, identical lifecycle IDs, staff MFA preserved.
- Web: 25 files / 102 tests green.
- Runtime: 1 file / 3 tests green.
- Shared: no test files; pass-with-no-tests green.
- API: 69 files / 274 tests green.
- Worker: 6 files / 16 tests green.
- Focused Journey projection: 1 file / 5 tests green.
- Typecheck: all five workspace projects green.
- Lint: green.
- Build: all five workspace projects green; existing non-blocking Vite chunk-size advisory only.

The first accumulated API run shared Redis database 0 with the persistent review worker and one real BullMQ case timed out at five seconds. The same nine-test durable-runtime file passed on isolated Redis database 15, and the authoritative complete accumulated run on that isolated logical database passed all 274 API tests. This was test-environment queue contention, not a product/runtime defect.

## Exact-final-head CI

Exact-final-head CI is triggered after this report is committed and the branch is pushed. The synchronized SHA and successful run URL are supplied in the product-owner handoff; the report commit contains no untested product-code change.

## Review environment

- Web: `http://localhost:5185`
- API: `http://localhost:3008`
- Database: `credit_strategy_phase1316_checkpoint` on the Credit PostgreSQL service
- Redis: Credit Redis on port `6380`

The environment remains running. Seeded review credentials remain in the existing approved out-of-band handoff and are intentionally not copied into the repository report.

## Boundary

Phase 18, public-site work, deployment work and merge into `ai-enabled` were not started. `main` and `baseline/current-non-ai` were not modified.
