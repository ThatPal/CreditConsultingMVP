# Phases 13–16 Contract Matrix

Starting head: `a2b212d6635ce4eb9989e03aec6068d156aba04e`

Audit state: COMPLETE — product code unchanged while this matrix was created.

Classification: **IP** = IMPLEMENTED + PROVEN; **II** = IMPLEMENTED + INSUFFICIENTLY PROVEN; **PARTIAL**; **MISSING**; **SUPERSEDED**; **N/A**.

## Sprint requirement reconciliation

| Sprint | Schema/data | Domain/invariants | Commands/API/auth | Events/Attention/AI | UI/routes | Failure/concurrency | Integration/tests/browser | Audit disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 13.1 Scheduling | IP | IP | IP | IP | IP | IP | IP | Internal Appointment truth, availability, book/reschedule/cancel and optional external-sync isolation exist. |
| 13.2 Live session | IP | IP | IP | IP | IP | IP | IP | Supervised session, presence lease, messaging, refetch-safe realtime and bounded DTOs exist. |
| 13.3 Pre-live/release | IP | IP | IP | IP | IP | IP | IP | Versioned confirmation and one-card frozen-Strategy release are server enforced. |
| 13.4 Results/branching | IP | IP | IP | IP | IP | IP | IP | Structured outcomes, Skip/Help and deterministic branch decision persist canonical events. |
| 13.5 End session/M7 | IP | IP | IP | IP | IP | IP | IP | End session remains separate from governed Round finalization; M7 regressions exist. |
| 14.1 Factual summary | IP | IP | IP | IP | IP | IP | IP | Totals exclude skipped applications and unknown limits; derived from canonical facts. |
| 14.2 Follow-up | IP | IP | IP | IP | IP | IP | IP | Pending/reconsideration/CLI tasks reconcile canonical Application/Card/Plan truth. |
| 14.3 Analysis | IP | IP | IP | IP | IP | IP | IP | Immutable Initial/Updated/Final versions and consultant approval; client DTO redacts internals. |
| 14.4 Finalization/M8 | IP | IP | IP | IP | IP | IP | IP | Separate locked, idempotent finalization revalidates blockers and writes downstream effects. |
| 15.1 Major intake | IP | IP | IP | IP | IP | IP | IP | Current Profile/Review and entitlement/case lifecycle gates are canonical. |
| 15.2 Recommendation | IP | IP | IP | IP | IP | IP | IP | Durable draft-only AI and explicit consultant approval reuse shared Plan. |
| 15.3 Coordination | IP | IP | IP | IP | IP | IP | IP | Versioned restrictions are enforced across Cycle/Strategy/Scheduling/Live/release. |
| 15.4 Reassessment/history | IP | IP | IP | IP | IP | IP | IP | Historical decisions remain immutable; release requires current downstream revalidation. |
| 16.1 Support operations | IP | IP | IP | IP | PARTIAL | IP | II | Routing API is sound, but CRM lacks usable claim/reassign/escalate controls and Client 360 lacks Support composition. |
| 16.2 AI Support | IP | IP | IP | IP | PARTIAL | IP | II | Durable advisory artifacts exist, but UI completion discovery is not reliably refreshed after asynchronous materialization. |
| 16.3 Delivery/Portal-41 | IP | PARTIAL | PARTIAL | PARTIAL | IP | IP | II | Generic delivery is retry-safe; Support replies bypass canonical email preference/delivery enqueue path. |

## Layer matrix for the accumulated block

| Layer | Classification | Evidence / gap |
| --- | --- | --- |
| Schema/data | IP | Appointment, ApplicationSession, immutable events, PostRound, RoundAnalysis, Major/Decision/Restriction, Support/AI/Notification records and migration history. |
| Domain/state/invariants | IP | Frozen Strategy, presence, material confirmation, outcome/finalization and restriction guards are server-side. |
| Commands/queries | IP | Consequential commands use idempotency, version claims and locked finalization where required. |
| API/DTO | PARTIAL | Minimum-safe DTOs generally hold; Support delivery and operations UI integration gaps are D1316-29/30. |
| Authorization/privacy | IP | Client ownership/capability checks; Consultant-only professional decisions; client DTO redaction. |
| Events/outbox/realtime | PARTIAL | Minimal invalidation envelopes are sound; Support AI completion and email delivery do not yet fully join canonical event flow. |
| Attention/notifications/audit | PARTIAL | Domain Attention reconciliation exists; Support reply delivery is not routed through canonical preference-aware delivery. |
| AI/provider behavior | IP | All AI paths are durable/provenance-bearing and advisory/preparation-only. |
| UI/routes/components | PARTIAL | Required primary routes exist; Support operational controls/Client 360 composition/AI completion refresh need correction. |
| Failure/recovery/concurrency/idempotency | IP | Version claims, idempotency records, outbox recovery, bounded delivery retry and stale claim recovery. |
| Upstream/downstream integration | IP | Plan/Cards/Cycle/Strategy/Live/PostRound/Major share canonical aggregates. |
| Tests/fixtures | II | Strong focused suites; accumulated real application proof must be added/run at checkpoint head. |
| Browser/application flow | II | Existing review surface is present, but launcher truth and Phase 16 operational gaps require correction and browser recheck. |

## Baseline D1316 dispositions

| ID | Disposition | Evidence / root cause |
| --- | --- | --- |
| D1316-01 | IP | Appointment is internal source of truth; external sync metadata is non-authoritative; client/CRM book/reschedule/cancel surfaces exist. |
| D1316-02 | IP | presence leases and consultant supervision guard start/release; realtime uses authorized rooms and refetch envelopes. |
| D1316-03 | IP | pre-live fingerprint/version is checked server-side before release. |
| D1316-04 | IP | version/idempotency claims; unreleased alternatives omitted; Skip distinct from application result. |
| D1316-05 | IP | appointment/session bind approved StrategyVersion; deterministic branch applications only. |
| D1316-06 | IP | post-round totals derive Application truth; unknown limits tracked separately. |
| D1316-07 | IP | follow-up completion updates canonical CreditApplication/Card and Plan outcome transactionally. |
| D1316-08 | IP | immutable version/source fingerprint; approval required; client projection redacts internal content/source. |
| D1316-09 | IP | finalization distinct, advisory-locked, blocker-revalidated, idempotent and downstream-integrated. |
| D1316-10 | IP | Major start validates current context and governed entitlement; payment is not a safety bypass. |
| D1316-11 | IP | recommendation is DRAFT_ONLY then consultant-approved; no lender guarantee; shared Plan used. |
| D1316-12 | IP | canonical restrictions enforced at Cycle, Strategy, Scheduling and Live/release commands. |
| D1316-13 | IP | restriction events invalidate; cleared restrictions do not reactivate stale Strategy/session. |
| D1316-14 | IP | immutable recommendation/decision history; client-safe projection excludes internal rationale. |
| D1316-15 | IP | Backend scale/routing plus optimistic CRM claim/unassign/escalate controls and bounded Client 360 Support composition are implemented and browser-proven. |
| D1316-16 | IP | typed ownership-checked resolvers return only bounded summary/link; foreign IDs fail closed. |
| D1316-17 | IP | client include filters internal messages and never includes AI artifacts; governed Documents reused. |
| D1316-18 | IP | Durable advisory AI, denylist, durable completion invalidation and bounded pending-job polling are implemented. |
| D1316-19 | IP | Both visible Support reply directions create preference-aware canonical Notification/Delivery/outbox work atomically and duplicate-safely. |
| D1316-20 | IP | deterministic Support pagination and notification cursor/filtering; protected destination routes fail closed. |
| D1316-21 | IP | app route hierarchy and exact/prefix navigation ownership reviewed; no orphan primary route found. |
| D1316-22 | IP | Launcher records owned PIDs, refuses occupied ports, propagates command failure, enforces a Credit-only database and verifies API/web health. |
| D1316-23 | IP | one Plan aggregate/version engine; reconciler preserves completed and consultant-approved history. |
| D1316-24 | IP | source-deduped WorkItems and semantic-key notifications; no new checklist engine. |
| D1316-25 | IP | Live, Analysis, Major and Support AI have separate bounded process/authority/provenance contracts. |
| D1316-26 | IP | professional routes are Consultant-only; grants remain scoped/dated; consequential step-up remains. |
| D1316-27 | IP | realtime envelopes contain clientId/domain/refetch identifiers, not profile/internal/AI content. |
| D1316-28 | IP | Responsive/accessibility component suites and real consultant CRM browser review passed without console errors. |

## Additional findings

| ID | Severity | Finding | Required correction/proof |
| --- | --- | --- | --- |
| D1316-29 | P1 | Support operations are API-capable but not realistically operable: CRM has no claim/reassign/escalate controls and Client 360 omits Support summary/history. | Add bounded staff directory + optimistic controls and Client 360 Support composition; UI/API tests. |
| D1316-30 | P1 | AI Support enqueue returns before materialization and the UI invalidates immediately only; completed artifacts can remain invisible without unrelated refresh. | Publish durable completion invalidation and poll/refetch boundedly while pending; prove manual fallback and new proposal visibility. |
| D1316-31 | P1 | Support reply writes one canonical in-app Notification but does not create preference-aware NotificationDelivery/outbox delivery work, so Phase 16.3’s Support communication retry path is not application-integrated. | Create canonical Support notification/delivery atomically with reply; prove duplicate key yields one message, notification, delivery and delivery event. |
| D1316-32 | P1 | Phase 13–16 review launcher can report success without owning the intended processes or verifying current API/UI routes. | Bring launcher to the truthful PID/port/health/current-route contract and test its static safety contract. |
| D1316-33 | P1 | Distributed `fetchSockets()` delayed consecutive local authorization rechecks enough to miss immediate revocation delivery under the accumulated gate. | Authorize this instance's local room sockets on every canonical event; prove resource delivery, live revocation and initial denial in an isolated Redis namespace. |
| D1316-34 | P1 | Exact-head Linux CI exposed retained queue work and unrelated poison events holding synchronous startup drain beyond the business-command proof boundary. | Make queue identity injectable for test isolation and bound startup to the single oldest event; preserve normal 25-event polling and restart identity. |
| D1316-35 | P1 | The durable outbox claim transaction incremented attempts but left a claimed row immediately eligible, allowing a concurrent worker to reclaim the same event while publication was still in flight. | Lease claimed rows through `availableAt` inside the claim transaction, retain bounded failure retry/recovery, and prove the complete worker suite against an isolated Credit database. |

All D1316-29 through D1316-35 corrections are implemented and proven. No other P0/P1 was found. Cosmetic P2/P3 work remains outside this checkpoint correction wave.
