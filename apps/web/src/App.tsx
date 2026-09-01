import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoadingSkeleton } from './components/common/Feedback';
import { AdminAppShell } from './layouts/AdminAppShell';
import { ClientAppShell } from './layouts/ClientAppShell';
import { ConsultantAppShell } from './layouts/ConsultantAppShell';
import { AccountPage } from './pages/AccountPage';
import { ApplicationCyclesPage } from './pages/ApplicationCyclesPage';
import { CardsPage } from './pages/CardsPage';
import { ConsultantSupportPage } from './pages/ConsultantSupportPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { GoalsPage } from './pages/GoalsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ServicesPage } from './pages/ServicesPage';
import { SecurityPage } from './pages/SecurityPage';
import { AdminLandingPage, FoundationPage, StaffAccountPage } from './pages/ShellPages';
import { SupportPage } from './pages/SupportPage';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  StaffMfaPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import {
  ClientOverviewPage,
  ConsultantDashboardPage,
  ReadinessPage,
  WorkQueuePage,
} from './pages/PlatformPages';
import { Client360Page, ClientsPage } from './pages/ClientContextPages';
import {
  ClientReviewPage,
  ConsultantReviewsPage,
  ConsultantReviewWorkspacePage,
  CreditProfilePage,
} from './pages/ReviewPages';

const DesignSystemPage = lazy(() =>
  import('./pages/dev/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })),
);
const ShellEvidencePage = lazy(() =>
  import('./pages/dev/ShellEvidencePage').then((module) => ({ default: module.ShellEvidencePage })),
);
export const isDesignSystemShowcaseEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<StaffMfaPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/lead-wizard" element={<OnboardingPage />} />
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
          <Route index element={<ClientOverviewPage />} />
          <Route
            path="journey"
            element={
              <FoundationPage
                title="Journey"
                description="Personalized journey projections will appear after their complete, verified workflow is accepted."
              />
            }
          />
          <Route path="credit-center" element={<CreditProfilePage />} />
          <Route path="credit-center/review" element={<ClientReviewPage />} />
          <Route path="readiness" element={<ReadinessPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="application-rounds" element={<ApplicationCyclesPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="services" element={<ServicesPage />} />
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
          <Route path="reviews" element={<ConsultantReviewsPage />} />
          <Route path="reviews/:clientId/:reviewId" element={<ConsultantReviewWorkspacePage />} />
          <Route path="readiness" element={<ReadinessPage consultant />} />
          <Route path="support" element={<ConsultantSupportPage />} />
          <Route
            path="sessions"
            element={
              <FoundationPage
                title="Live Sessions"
                description="Live session supervision is not available yet. No scheduled activity is inferred or displayed."
              />
            }
          />
          <Route
            path="calendar"
            element={
              <FoundationPage
                title="Calendar"
                description="Calendar scheduling is not available yet. No example appointments are displayed."
              />
            }
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
          <Route index element={<AdminLandingPage />} />
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
