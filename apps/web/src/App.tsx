import { CreditCenterShell } from './features/credit-center/CreditCenterShell';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoadingSkeleton } from './components/common/Feedback';
import { AdminAppShell } from './layouts/AdminAppShell';
import { ClientAppShell } from './layouts/ClientAppShell';
import { ConsultantAppShell } from './layouts/ConsultantAppShell';

import { GoalIntakePage } from './pages/GoalIntakePage';

import {
  AdminLandingPage,
  FoundationPage,
  StaffAccountPage,
  SystemHealthPage,
} from './pages/ShellPages';

import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  StaffMfaPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { ConsultantDashboardPage, ReadinessPage, WorkQueuePage } from './pages/PlatformPages';

import { ClientHomePage, ClientJourneyPage } from './pages/JourneyPages';

// Load authenticated feature families when opened; shell navigation stays available.
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })),
);
const MajorApplicationCheckPage = lazy(() =>
  import('./pages/Phase11Pages').then((module) => ({ default: module.MajorApplicationCheckPage })),
);
const RoundPage = lazy(() =>
  import('./pages/Phase11Pages').then((module) => ({ default: module.RoundPage })),
);
const SeasonalCyclePage = lazy(() =>
  import('./pages/Phase11Pages').then((module) => ({ default: module.SeasonalCyclePage })),
);
const ClientStrategyPage = lazy(() =>
  import('./pages/StrategyPages').then((module) => ({ default: module.ClientStrategyPage })),
);
const ConsultantStrategyPage = lazy(() =>
  import('./pages/StrategyPages').then((module) => ({ default: module.ConsultantStrategyPage })),
);
const PostRoundFollowUpPage = lazy(() =>
  import('./pages/PostRoundPages').then((module) => ({ default: module.PostRoundFollowUpPage })),
);
const PostRoundPage = lazy(() =>
  import('./pages/PostRoundPages').then((module) => ({ default: module.PostRoundPage })),
);
const RoundAnalysisPage = lazy(() =>
  import('./pages/PostRoundPages').then((module) => ({ default: module.RoundAnalysisPage })),
);
const RoundFinalizationPage = lazy(() =>
  import('./pages/PostRoundPages').then((module) => ({ default: module.RoundFinalizationPage })),
);
const ConsultantMajorReadinessPage = lazy(() =>
  import('./pages/MajorReadinessPages').then((module) => ({
    default: module.ConsultantMajorReadinessPage,
  })),
);
const MajorReadinessPage = lazy(() =>
  import('./pages/MajorReadinessPages').then((module) => ({ default: module.MajorReadinessPage })),
);
const AppointmentDetailPage = lazy(() =>
  import('./pages/LivePages').then((module) => ({ default: module.AppointmentDetailPage })),
);
const ConsultantCalendarPage = lazy(() =>
  import('./pages/LivePages').then((module) => ({ default: module.ConsultantCalendarPage })),
);
const LiveSessionPage = lazy(() =>
  import('./pages/LivePages').then((module) => ({ default: module.LiveSessionPage })),
);
const LiveSessionsPage = lazy(() =>
  import('./pages/LivePages').then((module) => ({ default: module.LiveSessionsPage })),
);
const ScheduleRoundPage = lazy(() =>
  import('./pages/LivePages').then((module) => ({ default: module.ScheduleRoundPage })),
);
const CardsPage = lazy(() =>
  import('./pages/CardsPage').then((module) => ({ default: module.CardsPage })),
);
const CardDetailPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({ default: module.CardDetailPage })),
);
const CardWishlistPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({ default: module.CardWishlistPage })),
);
const CatalogOperationsPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({ default: module.CatalogOperationsPage })),
);
const ConsultantClientCardsPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({
    default: module.ConsultantClientCardsPage,
  })),
);
const ExploreCardsPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({ default: module.ExploreCardsPage })),
);
const InsightOperationsPage = lazy(() =>
  import('./pages/CardCatalogPages').then((module) => ({ default: module.InsightOperationsPage })),
);
const ConsultantSupportPage = lazy(() =>
  import('./pages/ConsultantSupportPage').then((module) => ({
    default: module.ConsultantSupportPage,
  })),
);
const DocumentsPage = lazy(() =>
  import('./pages/DocumentsPage').then((module) => ({ default: module.DocumentsPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const GoalsPage = lazy(() =>
  import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })),
);
const ActiveServicesPage = lazy(() =>
  import('./pages/ServicesPage').then((module) => ({ default: module.ActiveServicesPage })),
);
const PurchaseHistoryPage = lazy(() =>
  import('./pages/ServicesPage').then((module) => ({ default: module.PurchaseHistoryPage })),
);
const ServicesPage = lazy(() =>
  import('./pages/ServicesPage').then((module) => ({ default: module.ServicesPage })),
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })),
);
const SecurityPage = lazy(() =>
  import('./pages/SecurityPage').then((module) => ({ default: module.SecurityPage })),
);
const SupportPage = lazy(() =>
  import('./pages/SupportPage').then((module) => ({ default: module.SupportPage })),
);
const Client360Page = lazy(() =>
  import('./pages/ClientContextPages').then((module) => ({ default: module.Client360Page })),
);
const ClientsPage = lazy(() =>
  import('./pages/ClientContextPages').then((module) => ({ default: module.ClientsPage })),
);
const ClientPlanPage = lazy(() =>
  import('./pages/PlanPages').then((module) => ({ default: module.ClientPlanPage })),
);
const ClientReviewPage = lazy(() =>
  import('./pages/ReviewPages').then((module) => ({ default: module.ClientReviewPage })),
);
const ConsultantReviewsPage = lazy(() =>
  import('./pages/ReviewPages').then((module) => ({ default: module.ConsultantReviewsPage })),
);
const ConsultantReviewWorkspacePage = lazy(() =>
  import('./pages/ReviewPages').then((module) => ({
    default: module.ConsultantReviewWorkspacePage,
  })),
);
const ConsultantClientCreditCenterPage = lazy(() =>
  import('./pages/PublishedCreditCenterPages').then((module) => ({
    default: module.ConsultantClientCreditCenterPage,
  })),
);
const PublishedCreditCenterPage = lazy(() =>
  import('./pages/PublishedCreditCenterPages').then((module) => ({
    default: module.PublishedCreditCenterPage,
  })),
);

const ConsultantPlanBuilderPage = lazy(() =>
  import('./features/plans/ConsultantPlanBuilderPage').then((module) => ({
    default: module.ConsultantPlanBuilderPage,
  })),
);

const DesignSystemPage = lazy(() =>
  import('./pages/dev/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })),
);
const ShellEvidencePage = lazy(() =>
  import('./pages/dev/ShellEvidencePage').then((module) => ({ default: module.ShellEvidencePage })),
);

// One domain-family boundary keeps the initial authenticated shell small while
// avoiding a waterfall of per-widget chunks. D0's shell boundary owns loading
// and render-failure recovery for every component in this family.
const AdminUsersPage = lazy(() =>
  import('./pages/AdminIdentityPages').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminUserDetailPage = lazy(() =>
  import('./pages/AdminIdentityPages').then((m) => ({ default: m.AdminUserDetailPage })),
);
const AdminAccessGrantsPage = lazy(() =>
  import('./pages/AdminIdentityPages').then((m) => ({ default: m.AdminAccessGrantsPage })),
);
const AdminEventListPage = lazy(() =>
  import('./pages/AdminAuditPages').then((m) => ({ default: m.AdminEventListPage })),
);
const AdminEventDetailPage = lazy(() =>
  import('./pages/AdminAuditPages').then((m) => ({ default: m.AdminEventDetailPage })),
);
const AdminAIJobsPage = lazy(() =>
  import('./pages/AdminAIJobsPages').then((m) => ({ default: m.AdminAIJobsPage })),
);
const AdminAIJobDetailPage = lazy(() =>
  import('./pages/AdminAIJobsPages').then((m) => ({ default: m.AdminAIJobDetailPage })),
);
const AdminAIProcessesPage = lazy(() =>
  import('./pages/AdminAIJobsPages').then((m) => ({ default: m.AdminAIProcessesPage })),
);
const AdminPaymentsPage = lazy(() =>
  import('./pages/AdminPaymentsPages').then((m) => ({ default: m.AdminPaymentsPage })),
);
const AdminPaymentDetailPage = lazy(() =>
  import('./pages/AdminPaymentsPages').then((m) => ({ default: m.AdminPaymentDetailPage })),
);
const AdminPayPalPage = lazy(() =>
  import('./pages/AdminPaymentsPages').then((m) => ({ default: m.AdminPayPalPage })),
);
const AdminStripePage = lazy(() =>
  import('./pages/AdminPaymentsPages').then((m) => ({ default: m.AdminStripePage })),
);
const AdminBofaPage = lazy(() =>
  import('./pages/AdminPaymentsPages').then((m) => ({ default: m.AdminBofaPage })),
);
const AdminServicesPage = lazy(() =>
  import('./pages/AdminServicesPages').then((m) => ({ default: m.AdminServicesPage })),
);
const AdminServiceDetailPage = lazy(() =>
  import('./pages/AdminServicesPages').then((m) => ({ default: m.AdminServiceDetailPage })),
);
const AdminSourcesPage = lazy(() =>
  import('./pages/AdminSourcesPage').then((m) => ({ default: m.AdminSourcesPage })),
);
const AdminWorkflowPage = lazy(() =>
  import('./pages/AdminWorkflowPage').then((m) => ({ default: m.AdminWorkflowPage })),
);
const AdminNotificationsPage = lazy(() =>
  import('./pages/AdminNotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })),
);
const AdminIntegrationsPage = lazy(() =>
  import('./pages/AdminIntegrationsPage').then((m) => ({ default: m.AdminIntegrationsPage })),
);
const AdminScheduledJobsPage = lazy(() =>
  import('./pages/AdminScheduledJobsPage').then((m) => ({ default: m.AdminScheduledJobsPage })),
);
const AdminRetentionPage = lazy(() =>
  import('./pages/AdminRetentionPage').then((m) => ({ default: m.AdminRetentionPage })),
);
const AdminReportsPage = lazy(() =>
  import('./pages/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })),
);
const AdminSettingsPage = lazy(() =>
  import('./pages/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
);

export const isDesignSystemShowcaseEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/goal-intake" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<StaffMfaPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/goal-intake" element={<GoalIntakePage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/lead-wizard" element={<Navigate to="/goal-intake" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {isDesignSystemShowcaseEnabled && (
        <Route
          path="/dev/design-system"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <DesignSystemPage />
            </Suspense>
          }
        />
      )}
      {isDesignSystemShowcaseEnabled && (
        <Route
          path="/dev/shell/:role"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <ShellEvidencePage />
            </Suspense>
          }
        />
      )}

      <Route element={<ProtectedRoute roles={['CLIENT']} />}>
        <Route path="/app" element={<ClientAppShell />}>
          <Route index element={<ClientHomePage />} />
          <Route path="journey" element={<ClientJourneyPage />} />
          <Route element={<CreditCenterShell />}>
            <Route path="plan" element={<ClientPlanPage />} />
            <Route path="credit-center/plan" element={<ClientPlanPage />} />
            <Route path="credit-center" element={<PublishedCreditCenterPage view="overview" />} />
            <Route
              path="credit-center/profile"
              element={<PublishedCreditCenterPage view="profile" />}
            />
            <Route
              path="credit-center/report"
              element={<PublishedCreditCenterPage view="report" />}
            />
            <Route
              path="credit-center/analysis"
              element={<PublishedCreditCenterPage view="analysis" />}
            />
            <Route
              path="credit-center/history"
              element={<PublishedCreditCenterPage view="history" />}
            />
          </Route>
          <Route path="credit-center/review" element={<ClientReviewPage />} />
          <Route path="readiness" element={<ReadinessPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="cards/explore" element={<ExploreCardsPage />} />
          <Route path="cards/wishlist" element={<CardWishlistPage />} />
          <Route path="cards/:productId" element={<CardDetailPage />} />
          <Route path="application-rounds" element={<SeasonalCyclePage />} />
          <Route path="rounds/:roundId" element={<RoundPage />} />
          <Route path="rounds/:roundId/major-check" element={<MajorApplicationCheckPage />} />
          <Route path="rounds/:roundId/strategy" element={<ClientStrategyPage />} />
          <Route path="rounds/:roundId/schedule" element={<ScheduleRoundPage />} />
          <Route path="rounds/:roundId/live" element={<LiveSessionPage />} />
          <Route path="rounds/:roundId/results" element={<PostRoundPage />} />
          <Route path="rounds/:roundId/follow-up" element={<PostRoundFollowUpPage />} />
          <Route path="rounds/:roundId/analysis" element={<RoundAnalysisPage />} />
          <Route path="major-readiness" element={<MajorReadinessPage />} />
          <Route
            path="major-readiness/readiness"
            element={<MajorReadinessPage view="readiness" />}
          />
          <Route
            path="major-readiness/preparation"
            element={<MajorReadinessPage view="preparation" />}
          />
          <Route
            path="major-readiness/coordination"
            element={<MajorReadinessPage view="coordination" />}
          />
          <Route path="major-readiness/timeline" element={<MajorReadinessPage view="timeline" />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/active" element={<ActiveServicesPage />} />
          <Route path="services/history" element={<PurchaseHistoryPage />} />
          <Route path="checkout/:purchaseIntentId" element={<CheckoutPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/security" element={<SecurityPage />} />
          <Route
            path="*"
            element={
              <FoundationPage
                title="Page not found"
                description="This portal route is not available."
              />
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['CONSULTANT']} />}>
        <Route path="/crm" element={<ConsultantAppShell />}>
          <Route index element={<ConsultantDashboardPage />} />
          <Route path="work-queue" element={<WorkQueuePage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:clientId" element={<Client360Page />} />
          <Route
            path="clients/:clientId/plan"
            element={
              <Suspense fallback={<LoadingSkeleton />}>
                <ConsultantPlanBuilderPage />
              </Suspense>
            }
          />
          <Route path="clients/:clientId/cards" element={<ConsultantClientCardsPage />} />
          <Route
            path="clients/:clientId/rounds/:roundId/strategy"
            element={<ConsultantStrategyPage />}
          />
          <Route
            path="clients/:clientId/rounds/:roundId/results"
            element={<PostRoundPage consultant />}
          />
          <Route
            path="clients/:clientId/rounds/:roundId/analysis"
            element={<RoundAnalysisPage consultant />}
          />
          <Route
            path="clients/:clientId/rounds/:roundId/finalize"
            element={<RoundFinalizationPage />}
          />
          <Route
            path="clients/:clientId/major-readiness/:caseId"
            element={<ConsultantMajorReadinessPage />}
          />
          <Route
            path="clients/:clientId/credit-center"
            element={<ConsultantClientCreditCenterPage />}
          />
          <Route
            path="clients/:clientId/reviews/:reviewId"
            element={<ConsultantReviewWorkspacePage />}
          />
          <Route path="reviews" element={<ConsultantReviewsPage />} />
          <Route path="card-catalog" element={<ExploreCardsPage consultant />} />
          <Route path="card-insights" element={<InsightOperationsPage canApprove />} />
          <Route path="reviews/:clientId/:reviewId" element={<ConsultantReviewWorkspacePage />} />
          <Route path="readiness" element={<ReadinessPage consultant />} />
          <Route path="support" element={<ConsultantSupportPage />} />
          <Route path="sessions" element={<LiveSessionsPage />} />
          <Route path="live-sessions" element={<LiveSessionsPage />} />
          <Route path="live-sessions/:sessionId" element={<LiveSessionPage consultant />} />
          <Route path="calendar" element={<ConsultantCalendarPage />} />
          <Route
            path="clients/:clientId/appointments/:appointmentId"
            element={<AppointmentDetailPage />}
          />
          <Route path="account" element={<StaffAccountPage />} />
          <Route path="account/security" element={<SecurityPage />} />
          <Route
            path="*"
            element={
              <FoundationPage
                title="Page not found"
                description="This CRM route is not available."
              />
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminAppShell />}>
          <Route path="card-catalog" element={<CatalogOperationsPage />} />
          <Route path="card-insights" element={<InsightOperationsPage />} />
          <Route index element={<AdminLandingPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="access-grants" element={<AdminAccessGrantsPage />} />
          <Route path="audit-events" element={<AdminEventListPage kind="audit" />} />
          <Route path="audit-events/:eventId" element={<AdminEventDetailPage kind="audit" />} />
          <Route path="security-events" element={<AdminEventListPage kind="security" />} />
          <Route
            path="security-events/:eventId"
            element={<AdminEventDetailPage kind="security" />}
          />
          <Route path="ai/jobs" element={<AdminAIJobsPage />} />
          <Route path="ai/jobs/:jobId" element={<AdminAIJobDetailPage />} />
          <Route path="ai/processes" element={<AdminAIProcessesPage />} />
          <Route path="sources" element={<AdminSourcesPage />} />
          <Route path="workflow-rules" element={<AdminWorkflowPage />} />
          <Route path="notification-operations" element={<AdminNotificationsPage />} />
          <Route path="integrations" element={<AdminIntegrationsPage />} />
          <Route path="scheduled-jobs" element={<AdminScheduledJobsPage />} />
          <Route path="system-health" element={<SystemHealthPage />} />
          <Route path="retention" element={<AdminRetentionPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="services/:serviceProductId" element={<AdminServiceDetailPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="payments/:paymentId" element={<AdminPaymentDetailPage />} />
          <Route path="integrations/paypal" element={<AdminPayPalPage />} />
          <Route path="integrations/stripe" element={<AdminStripePage />} />
          <Route path="integrations/bofa" element={<AdminBofaPage />} />
          <Route path="account" element={<StaffAccountPage />} />
          <Route path="account/security" element={<SecurityPage />} />
          <Route
            path="*"
            element={
              <FoundationPage
                title="Page not found"
                description="This Admin route is not available or is not yet implemented."
              />
            }
          />
        </Route>
      </Route>

      <Route path="/client" element={<Navigate to="/app" replace />} />
      <Route path="/client/overview" element={<Navigate to="/app" replace />} />
      <Route path="/client/credit-profile" element={<Navigate to="/app/credit-center" replace />} />
      <Route path="/client/account" element={<Navigate to="/app/account" replace />} />
      <Route path="/consultant" element={<Navigate to="/crm" replace />} />
      <Route path="/consultant/dashboard" element={<Navigate to="/crm" replace />} />
      <Route path="/consultant/account" element={<Navigate to="/crm/account" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
