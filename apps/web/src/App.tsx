import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from './components/common/Feedback';
import { ClientAppShell } from './layouts/ClientAppShell';
import { ConsultantAppShell } from './layouts/ConsultantAppShell';
import { clientNavigation, consultantNavigation } from './layouts/navigation';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AccountPage } from './pages/AccountPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { GoalsPage } from './pages/GoalsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { CardsPage } from './pages/CardsPage';
import { ApplicationCyclesPage } from './pages/ApplicationCyclesPage';
import { SupportPage } from './pages/SupportPage';
import { ConsultantSupportPage } from './pages/ConsultantSupportPage';
import { ServicesPage } from './pages/ServicesPage';
import { AdministrationPage } from './pages/AdministrationPage';
import {
  ConsultantAccountPage,
  ForgotPasswordPage,
  LoginPage,
  StaffMfaPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/AuthPages';
import {
  ClientOverviewPage,
  ClientsPage,
  ConsultantDashboardPage,
  ReadinessPage,
  SimpleDomainPage,
  WorkQueuePage,
} from './pages/PlatformPages';
import {
  ClientReviewPage,
  ConsultantReviewsPage,
  ConsultantReviewWorkspacePage,
  CreditProfilePage,
} from './pages/ReviewPages';

const DesignSystemPage = lazy(() =>
  import('./pages/dev/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })),
);

export const isDesignSystemShowcaseEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<StaffMfaPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
      <Route element={<ProtectedRoute roles={['CLIENT']} />}>
        <Route path="/client" element={<ClientAppShell />}>
          {clientNavigation.map((item) => (
            <Route
              key={item.path}
              path={item.path.replace('/client/', '')}
              element={
                item.path === '/client/account' ? (
                  <AccountPage />
                ) : item.path === '/client/goals' ? (
                  <GoalsPage />
                ) : item.path === '/client/services' ? (
                  <ServicesPage />
                ) : item.path === '/client/overview' ? (
                  <ClientOverviewPage />
                ) : item.path === '/client/credit-profile' ? (
                  <CreditProfilePage />
                ) : item.path === '/client/readiness' ? (
                  <ReadinessPage />
                ) : item.path === '/client/cards' ? (
                  <CardsPage />
                ) : item.path === '/client/application-rounds' ? (
                  <ApplicationCyclesPage />
                ) : item.path === '/client/documents' ? (
                  <DocumentsPage />
                ) : item.path === '/client/support' ? (
                  <SupportPage />
                ) : (
                  <PlaceholderPage />
                )
              }
            />
          ))}
          <Route path="credit-profile/review" element={<ClientReviewPage />} />
          <Route
            path="credit-profile-v2"
            element={<Navigate to="/client/credit-profile" replace />}
          />
          <Route path="credit-center" element={<Navigate to="/client/credit-profile" replace />} />
          <Route
            path="credit-center/review"
            element={<Navigate to="/client/credit-profile/review" replace />}
          />
          <Route
            path="credit-center-v2"
            element={<Navigate to="/client/credit-profile" replace />}
          />
          <Route path="credit-plan" element={<Navigate to="/client/credit-profile" replace />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={['CONSULTANT', 'ADMIN']} />}>
        <Route path="/consultant" element={<ConsultantAppShell />}>
          {consultantNavigation.map((item) => (
            <Route
              key={item.path}
              path={item.path.replace('/consultant/', '')}
              element={
                item.path === '/consultant/dashboard' ? (
                  <ConsultantDashboardPage />
                ) : item.path === '/consultant/work-queue' ? (
                  <WorkQueuePage />
                ) : item.path === '/consultant/clients' ? (
                  <ClientsPage />
                ) : item.path === '/consultant/readiness' ? (
                  <ReadinessPage consultant />
                ) : item.path === '/consultant/reviews' ? (
                  <ConsultantReviewsPage />
                ) : item.path === '/consultant/support' ? (
                  <ConsultantSupportPage />
                ) : item.path === '/consultant/administration' ? (
                  <AdministrationPage />
                ) : (
                  <SimpleDomainPage
                    title={item.label}
                    description="A selection-first operational workspace with prepared decisions, suggested actions, and audit history."
                    action="Open next item"
                  />
                )
              }
            />
          ))}
          <Route path="reviews/:clientId/:reviewId" element={<ConsultantReviewWorkspacePage />} />
          <Route path="account" element={<ConsultantAccountPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
