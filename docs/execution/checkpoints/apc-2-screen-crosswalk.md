# APC-2 authenticated screen crosswalk — working audit

Baseline c0da7e289b1df3560e37f364fca75861c1e481da, same rapid branch.
This is a coverage inventory, not a passed acceptance gate. Grouped IDs are
explicitly listed where one component implements several contracted views.
Browser observation means actual render/read-only navigation, not completion of
every consequential action. Missing fixtures and unexecuted proofs are not passes.

| Document13 screen(s) | Current implementation / route | Evidence and remaining work |
| --- | --- | --- |
| AUTH-01 | AuthPages, /register | Code/tests inspected; current registration workflow not submitted during this audit. |
| AUTH-02 | AuthPages, /login | Actual Client login and user-assisted staff login succeeded. |
| AUTH-03 | AuthPages email verification | Full email-delivery/browser round trip still required. |
| AUTH-04 | AuthPages forgot/reset | Focused auth regression retained; no review-account password reset performed. |
| AUTH-05 | MFA page /mfa | User reproduced loop; authorized repair,13API+31web auth tests; both staff roles successfully enrolled/verified. |
| AUTH-06 | SecurityPage | No account resets/revocations performed as audit shortcuts; security/session interaction review pending. |
| PORTAL-01 | Journey-derived Home /app | Browser loads current focus and summary; scope/richness APC-013/053. |
| PORTAL-02 | JourneyPages /app/journey | Code inspected; history retrieval and populated cycle continuity require proof. |
| PORTAL-03 | GoalsPage /app/goals | Phase4 implementation exists; full canonical preference recheck pending. |
| PORTAL-04 | PublishedCreditCenterPages /app/credit-center | Actual published decision/scores load; APC-012. |
| PORTAL-05 | PublishedCreditCenterPages /profile | Actual financial values render; dark generic stack, APC-012/053. |
| PORTAL-06 | PublishedCreditCenterPages /report | Route present; protected report browser proof pending. |
| PORTAL-07 | PublishedCreditCenterPages /analysis | Route present; published/draft separation verification pending. |
| PORTAL-08 | PlanPages /app/plan | Actual available/locked items; not nested CC navigation. APC-002/008. No outcome submitted. |
| PORTAL-09 | PublishedCreditCenterPages /history | Route exists; multi-version retrieval proof pending. |
| PORTAL-10, PORTAL-11, PORTAL-12, PORTAL-13, PORTAL-14, PORTAL-15, PORTAL-16 | ReviewPages guided review | Code/schema inspected in parts; complete report/credit/upload/intake/submission fixture needed for actual continuous flow. Do not count seeded incomplete review as proof. |
| PORTAL-17 | Cards portfolio /app/cards | Actual zero-account seed renders; conflicts with populated published summary require fixture reconciliation. |
| PORTAL-18 | CardCatalogPages /app/cards/explore | Actual four products after authorized capability correction; APC-014. |
| PORTAL-19 | CardCatalogPages wishlist | Route exists; add/remove/browser continuity not exercised. |
| PORTAL-20 | CardCatalogPages detail | Code fetches catalog then finds record; volume-safe detail proof CAPC-005. |
| PORTAL-21 | ServicesPage /app/services | Registered; current full browser recheck pending. |
| PORTAL-22 | ActiveServicesPage /services/active | Registered; entitlement projection recheck pending. |
| PORTAL-23 | PurchaseHistoryPage /services/history | Registered; historical paging/detail recheck pending. |
| PORTAL-24 | CheckoutPage /checkout/:purchaseIntentId | No purchase/payment initiated in audit; sandbox workflow proof pending. |
| PORTAL-25 | Phase11Pages RoundPage | Code inspected; lifecycle hub APC-029. |
| PORTAL-26 | Phase11Pages MajorApplicationCheckPage | Registered; populated gate/browser proof pending. |
| PORTAL-27 | ClientStrategyPage | Stale/approval handling exists; scheduling/preparation handoff APC-030. |
| PORTAL-28 | LivePages scheduling | Code inspected; availability/reschedule lifecycle requires populated fixture. |
| PORTAL-29, PORTAL-30 | LiveSessionPage | Shared local-state UI; issuer handoff and typed outcomes/realtime gaps. CAPC-001/002, APC-023/024. |
| PORTAL-31, PORTAL-32, PORTAL-33 | PostRoundPages | Typed follow-up and analysis-workspace gaps APC-025/026; no financial/application outcome mutated. |
| PORTAL-34, PORTAL-35, PORTAL-36, PORTAL-37, PORTAL-38 | MajorReadinessPage views | Intake/context, preparation link and timeline implemented thinly; APC-028, CAPC-020 projection proof. |
| PORTAL-39 | SupportPage | Actual14requests, unresolved before resolved; searchable/paged composer and picker observed. |
| PORTAL-40 | SupportPage detail | No new reply submitted; message/attachment/retry proof remains. |
| PORTAL-41 | NotificationsPage | Code confirms retry/grouping/load-more; categories APC-044. |
| PORTAL-42 | DocumentsPage | Actual25documents/search; one-result search verified; upload/failure proof remains. |
| PORTAL-43 | AccountPage | Profile/timezone code exists, preferences APC-043. |
| PORTAL-44 | SecurityPage | Own-session management route; destructive controls not invoked. |
| CRM-01 | ConsultantDashboardPage | Actual metrics load; count scope/legacy assignment refinement APC-010. |
| CRM-02 | WorkQueuePage | Actual12items and correct Support deep link after fix; Support-only family limitation. |
| CRM-03 | ClientsPage | Actual25authorized clients, adjacent20/5pages without overlap; not a stress test. |
| CRM-04 | Client360Page | Actual Jordan context stack; persistent seven-tab workspace missing. |
| CRM-05 | Client360 embedded Journey | Dedicated journey route absent; APC-009. |
| CRM-06 | ConsultantClientCreditCenterPage | Registered; seeded Review workspace missing report, CAPC-012. |
| CRM-07 | ConsultantClientCardsPage | Registered client-scoped route; populated portfolio browser check pending. |
| CRM-08 | Client360 embedded Services | Actual summary; no dedicated services workspace route. |
| CRM-09 | Client360 embedded Timeline | Actual three auth events only; domain timeline coverage pending. |
| CRM-10 | Client360 embedded Support | Actual five recent cases; dedicated contextual Support route absent. |
| CRM-11 | ConsultantReviewWorkspacePage | Seeded guided link404 traced to missing report; typed verification APC-051. |
| CRM-12 | ConsultantPlanBuilderPage | Actual seeded active plan with starter form; draft preservation CAPC-003. |
| CRM-13, CRM-14, CRM-15, CRM-16, CRM-17 | ConsultantStrategyPage | Single stacked workspace with shortlist/compare/sequence/approval; sustained-context, rules, autosave and populated workflow proofs remain. |
| CRM-18 | LiveSessionsPage | Actual empty list; persistent operating affordance absent. |
| CRM-19 | LiveSessionPage consultant | Code inspected; full live fixture/presence/reconnect/browser proof pending. |
| CRM-20 | PostRoundPages consultant | Separate result/analysis/finalize routes; full editing workspace missing. |
| CRM-21 | ConsultantMajorReadinessPage | Thin commands/context; CAPC-020 old-approved vs draft selection reproduced without DB mutation. |
| CRM-22 | ConsultantSupportPage | Actual13active rows vs14total; post-page predicate CAPC-011. |
| CRM-23 | ConsultantSupportPage detail | Actual correct case from Work Queue; advisory controls and internal/client reply fields observed. |
| CRM-24 | CatalogOperationsPage | Actual denial through operational route; not a coherent shared research surface. |
| CRM-25 | Card detail/insight context | Separate insight operations route, not canonical unified research detail; further API reconciliation required. |
| CRM-26 | ConsultantCalendarPage | Actual empty calendar; scheduling lifecycle not proven. |
| CRM-27 | AppointmentDetailPage | Registered; error/pending gap CAPC-006. |
| CRM-28 | StaffAccountPage/SecurityPage | User-assisted authentication verified; preference/session interaction audit incomplete. |
| ADMIN-01 | AdminLandingPage | Actual metrics after route fix; dead system-health link CAPC-023. |
| ADMIN-02 | AdminUsersPage | Actual337users, search,20-row paging and MFA/session chips. |
| ADMIN-03 | AdminUserDetailPage | Actual role/capability/MFA/session display; no operational mutation invoked. |
| ADMIN-04 | AdminAccessGrantsPage | Code history/revoke only, create/assignment lifecycle missing APC-041. |
| ADMIN-05, ADMIN-06 | AdminServicesPages | Registered; pricing/entitlement lifecycle browser audit still required. |
| ADMIN-07 | AdminPaymentsPage | Actual3payments; stale search independently reproduced CAPC-018. |
| ADMIN-08 | AdminPaymentDetailPage | Actual PayPal detail/refund history; no payment command invoked. |
| ADMIN-09, ADMIN-10 | Provider gateway pages | Existing provider-specific routes; governed integration hierarchy refinement APC-046. No connection/config changes. |
| ADMIN-11, ADMIN-12, ADMIN-13 | Catalog/InsightOperations | Registered but hidden group; no widening of professional approval authority. |
| ADMIN-14, ADMIN-15 | AdminAIJobsPages | Routes/code exist; populated job detail browser audit pending. |
| ADMIN-16 | AdminAIProcessesPage | Actual11process rows and two-field disabled-draft form; lifecycle missing. |
| ADMIN-17 | AdminSourcesPage | Actual register-disabled and disable only; policy test missing. |
| ADMIN-18 | AdminWorkflowPage | Actual trigger/action draft form; execution consumer gap CAPC-014. |
| ADMIN-19 | AdminNotificationsPage | Actual templates and50near-identical delivery rows; preview/activation missing. |
| ADMIN-20, ADMIN-21 | AdminIntegrationsPage | Actual email row/enable; no sustained detail/test/configuration surface. |
| ADMIN-22 | AdminScheduledJobsPage | Actual3disabled jobs; execution gap CAPC-013. |
| ADMIN-23 | AdminAuditPages | Code cursor/list/detail; authorized link flaw CAPC-016. |
| ADMIN-24 | AdminAuditPages security | Actual50-event page and successful MFA detail; immutable history preserved. |
| ADMIN-25 | AdminRetentionPage | Actual expired-session-only preview/disabled execution; document retention contract gap. |
| ADMIN-26 | AdminReportsPage | Actual raw JSON and fixed30-day view. |
| ADMIN-27 | AdminSettingsPage | Actual four boolean switches; typed configuration and honest error-state gaps. |

Next: reconcile each outstanding screen against owning sprint amendments and
realistic fixtures, then run browser workflows/keyboard/responsive checks. This
inventory deliberately does not turn unavailable or empty-state paths into passes.
