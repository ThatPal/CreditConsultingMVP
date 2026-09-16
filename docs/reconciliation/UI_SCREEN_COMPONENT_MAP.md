# Screen/component reconciliation — inventory checkpoint

Baseline: 44a905b. Generated from the current TypeScript route tree, not the old audit CSV. 120 route declarations; 47 shared/feature/layout modules.

**U0 mapping acceptance is pending.** Classifications below are proposed migration treatments, not certified KEEP decisions. The U1 reference slice has source/browser evidence in U1_TRUTH_MAP and U1_VISUAL_BASELINE. All other rows require final exact-spec review before implementation. Module-level API/child extraction may include siblings exported by that module; it is discovery evidence, not a per-render dependency graph.

[Route details](route-inventory.json) include implementation files, current API references, major child components, desktop/mobile evidence and review status. [Shared modules](shared-component-inventory.json) provide the full component review queue. Missing final surfaces and duplicate aliases must be resolved against the final coverage register before U0 passes.

| Current route                                      | Component                        | Final family                                | Proposed treatment | Wave |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------- | ------------------ | ---- |
| /                                                  | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /login                                             | LoginPage                        | Auth / account / security                   | RESTYLE            | U2   |
| /mfa                                               | StaffMfaPage                     | Auth / account / security                   | RESTYLE            | U2   |
| /register                                          | RegisterPage                     | Auth / account / security                   | RESTYLE            | U2   |
| /goal-intake                                       | GoalIntakePage                   | Goals / onboarding                          | REBUILD            | U4   |
| /verify-email                                      | VerifyEmailPage                  | Auth / account / security                   | RESTYLE            | U2   |
| /lead-wizard                                       | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /forgot-password                                   | ForgotPasswordPage               | Auth / account / security                   | RESTYLE            | U2   |
| /reset-password                                    | ResetPasswordPage                | Auth / account / security                   | RESTYLE            | U2   |
| /dev/design-system                                 | LoadingSkeleton                  | Pending final family review                 | RECOMPOSE          | U8   |
| /dev/shell/:role                                   | LoadingSkeleton                  | Pending final family review                 | RECOMPOSE          | U8   |
| /app                                               | ClientAppShell                   | CP-SHELL-01                                 | RECOMPOSE          | U1   |
| /app                                               | ClientHomePage                   | CP-01                                       | RECOMPOSE          | U1   |
| /app/journey                                       | ClientJourneyPage                | PORTAL-02 Journey                           | REBUILD            | U1   |
| /app/plan                                          | ClientPlanPage                   | CP-PL-01 / CP-AC-01 / CP-AC-02              | RECOMPOSE          | U1   |
| /app/credit-center                                 | PublishedCreditCenterPage        | CP-CC-01/03/06/09/10                        | REBUILD            | U1   |
| /app/credit-center/profile                         | PublishedCreditCenterPage        | CP-CC-01/03/06/09/10                        | REBUILD            | U1   |
| /app/credit-center/report                          | PublishedCreditCenterPage        | CP-CC-01/03/06/09/10                        | REBUILD            | U1   |
| /app/credit-center/analysis                        | PublishedCreditCenterPage        | CP-CC-01/03/06/09/10                        | REBUILD            | U1   |
| /app/credit-center/history                         | PublishedCreditCenterPage        | CP-CC-01/03/06/09/10                        | REBUILD            | U1   |
| /app/credit-center/review                          | ClientReviewPage                 | CP-CC / CRM-11 Review                       | REBUILD            | U3   |
| /app/readiness                                     | ReadinessPage                    | Legacy readiness → owning Review/Plan/Round | RETIRE             | U4   |
| /app/cards                                         | CardsPage                        | Cards / catalog / research                  | REBUILD            | U5   |
| /app/cards/explore                                 | ExploreCardsPage                 | Cards / catalog / research                  | REBUILD            | U5   |
| /app/cards/wishlist                                | CardWishlistPage                 | Cards / catalog / research                  | REBUILD            | U5   |
| /app/cards/:productId                              | CardDetailPage                   | Cards / catalog / research                  | REBUILD            | U5   |
| /app/application-rounds                            | SeasonalCyclePage                | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId                               | RoundPage                        | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId/major-check                   | MajorApplicationCheckPage        | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId/strategy                      | ClientStrategyPage               | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId/schedule                      | ScheduleRoundPage                | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId/live                          | LiveSessionPage                  | Round / strategy / live / appointment       | REBUILD            | U6   |
| /app/rounds/:roundId/results                       | PostRoundPage                    | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/rounds/:roundId/follow-up                     | PostRoundFollowUpPage            | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/rounds/:roundId/analysis                      | RoundAnalysisPage                | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/major-readiness                               | MajorReadinessPage               | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/major-readiness/readiness                     | MajorReadinessPage               | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/major-readiness/preparation                   | MajorReadinessPage               | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/major-readiness/coordination                  | MajorReadinessPage               | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/major-readiness/timeline                      | MajorReadinessPage               | Post-Round / Major Readiness                | REBUILD            | U7   |
| /app/goals                                         | GoalsPage                        | Goals / onboarding                          | REBUILD            | U4   |
| /app/services                                      | ServicesPage                     | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /app/services/active                               | ActiveServicesPage               | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /app/services/history                              | PurchaseHistoryPage              | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /app/checkout/:purchaseIntentId                    | CheckoutPage                     | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /app/documents                                     | DocumentsPage                    | Support / Documents / Notifications         | RECOMPOSE          | U8   |
| /app/notifications                                 | NotificationsPage                | Support / Documents / Notifications         | RECOMPOSE          | U8   |
| /app/support                                       | SupportPage                      | Support / Documents / Notifications         | RECOMPOSE          | U8   |
| /app/account                                       | AccountPage                      | Auth / account / security                   | RESTYLE            | U2   |
| /app/account/security                              | SecurityPage                     | Auth / account / security                   | RESTYLE            | U2   |
| /app/*                                             | FoundationPage                   | Route alias / safe fallback                 | KEEP               | U9   |
| /crm                                               | ConsultantAppShell               | Pending final family review                 | RECOMPOSE          | U8   |
| /crm                                               | ConsultantDashboardPage          | CRM-01/02/03/04                             | RECOMPOSE          | U8   |
| /crm/work-queue                                    | WorkQueuePage                    | CRM-01/02/03/04                             | RECOMPOSE          | U8   |
| /crm/clients                                       | ClientsPage                      | CRM-01/02/03/04                             | RECOMPOSE          | U8   |
| /crm/clients/:clientId                             | Client360Page                    | CRM-01/02/03/04                             | RECOMPOSE          | U8   |
| /crm/clients/:clientId/plan                        | LoadingSkeleton                  | Pending final family review                 | RECOMPOSE          | U8   |
| /crm/clients/:clientId/cards                       | ConsultantClientCardsPage        | Cards / catalog / research                  | REBUILD            | U5   |
| /crm/clients/:clientId/rounds/:roundId/strategy    | ConsultantStrategyPage           | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/clients/:clientId/rounds/:roundId/results     | PostRoundPage                    | Post-Round / Major Readiness                | REBUILD            | U7   |
| /crm/clients/:clientId/rounds/:roundId/analysis    | RoundAnalysisPage                | Post-Round / Major Readiness                | REBUILD            | U7   |
| /crm/clients/:clientId/rounds/:roundId/finalize    | RoundFinalizationPage            | Post-Round / Major Readiness                | REBUILD            | U7   |
| /crm/clients/:clientId/major-readiness/:caseId     | ConsultantMajorReadinessPage     | Post-Round / Major Readiness                | REBUILD            | U7   |
| /crm/clients/:clientId/credit-center               | ConsultantClientCreditCenterPage | CRM-06                                      | RECOMPOSE          | U3   |
| /crm/clients/:clientId/reviews/:reviewId           | ConsultantReviewWorkspacePage    | CP-CC / CRM-11 Review                       | REBUILD            | U3   |
| /crm/reviews                                       | ConsultantReviewsPage            | CP-CC / CRM-11 Review                       | REBUILD            | U3   |
| /crm/card-catalog                                  | ExploreCardsPage                 | Cards / catalog / research                  | REBUILD            | U5   |
| /crm/card-insights                                 | InsightOperationsPage            | Cards / catalog / research                  | REBUILD            | U5   |
| /crm/reviews/:clientId/:reviewId                   | ConsultantReviewWorkspacePage    | CP-CC / CRM-11 Review                       | REBUILD            | U3   |
| /crm/readiness                                     | ReadinessPage                    | Legacy readiness → owning Review/Plan/Round | RETIRE             | U4   |
| /crm/support                                       | ConsultantSupportPage            | Support / Documents / Notifications         | RECOMPOSE          | U8   |
| /crm/sessions                                      | LiveSessionsPage                 | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/live-sessions                                 | LiveSessionsPage                 | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/live-sessions/:sessionId                      | LiveSessionPage                  | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/calendar                                      | ConsultantCalendarPage           | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/clients/:clientId/appointments/:appointmentId | AppointmentDetailPage            | Round / strategy / live / appointment       | REBUILD            | U6   |
| /crm/account                                       | StaffAccountPage                 | Auth / account / security                   | RESTYLE            | U2   |
| /crm/account/security                              | SecurityPage                     | Auth / account / security                   | RESTYLE            | U2   |
| /crm/*                                             | FoundationPage                   | Route alias / safe fallback                 | KEEP               | U9   |
| /admin                                             | AdminAppShell                    | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/card-catalog                                | CatalogOperationsPage            | Cards / catalog / research                  | REBUILD            | U5   |
| /admin/card-insights                               | InsightOperationsPage            | Cards / catalog / research                  | REBUILD            | U5   |
| /admin                                             | AdminLandingPage                 | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/users                                       | AdminUsersPage                   | ADMIN-02/03/04                              | RECOMPOSE          | U2   |
| /admin/users/:userId                               | AdminUserDetailPage              | ADMIN-02/03/04                              | RECOMPOSE          | U2   |
| /admin/access-grants                               | AdminAccessGrantsPage            | ADMIN-02/03/04                              | RECOMPOSE          | U2   |
| /admin/audit-events                                | AdminEventListPage               | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/audit-events/:eventId                       | AdminEventDetailPage             | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/security-events                             | AdminEventListPage               | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/security-events/:eventId                    | AdminEventDetailPage             | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/ai/jobs                                     | AdminAIJobsPage                  | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/ai/jobs/:jobId                              | AdminAIJobDetailPage             | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/ai/processes                                | AdminAIProcessesPage             | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/sources                                     | AdminSourcesPage                 | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/workflow-rules                              | AdminWorkflowPage                | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/notification-operations                     | AdminNotificationsPage           | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/integrations                                | AdminIntegrationsPage            | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/scheduled-jobs                              | AdminScheduledJobsPage           | Round / strategy / live / appointment       | REBUILD            | U6   |
| /admin/system-health                               | SystemHealthPage                 | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/retention                                   | AdminRetentionPage               | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/reports                                     | AdminReportsPage                 | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/settings                                    | AdminSettingsPage                | Admin operational surfaces                  | RECOMPOSE          | U8   |
| /admin/services                                    | AdminServicesPage                | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/services/:serviceProductId                  | AdminServiceDetailPage           | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/payments                                    | AdminPaymentsPage                | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/payments/:paymentId                         | AdminPaymentDetailPage           | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/integrations/paypal                         | AdminPayPalPage                  | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/integrations/stripe                         | AdminStripePage                  | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/integrations/bofa                           | AdminBofaPage                    | Services / commerce / gateways              | RECOMPOSE          | U7   |
| /admin/account                                     | StaffAccountPage                 | Auth / account / security                   | RESTYLE            | U2   |
| /admin/account/security                            | SecurityPage                     | Auth / account / security                   | RESTYLE            | U2   |
| /admin/*                                           | FoundationPage                   | Route alias / safe fallback                 | KEEP               | U9   |
| /client                                            | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /client/overview                                   | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /client/credit-profile                             | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /client/account                                    | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /consultant                                        | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /consultant/dashboard                              | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /consultant/account                                | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |
| /*                                                 | Navigate                         | Route alias / safe fallback                 | KEEP               | U9   |

## Confirmed reference-slice gaps

- Dedicated Action list/detail routes are absent; current response UI is embedded in Plan. Target CP-AC-01/02 is MISSING as a separate canonical navigation surface. Preserve response controls when introducing it.
- Plan Overview/Decisions/Nurture views are absent; current Plan page lists one selected published Plan.
- Final Credit Center DTO composition/currentness/Plan connection is absent. Existing Profile/Analysis/History routes are implementation material.
- Final primary navigation lacks Credit Plan and still elevates legacy service destinations.
- Public marketing remains absent at the root; root redirects to intake.

Do not delete aliases or legacy screens until replacement behavior and deep-link compatibility are proved.
