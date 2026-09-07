import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';
import { navigationFor } from './navigation';
import { useAuth } from '../auth/AuthProvider';
import { RouteReadyBoundary } from '../components/common/RouteReadyBoundary';
export function ConsultantAppShell() {
  const { user } = useAuth();
  return (
    <AppShell role="consultant" items={user ? navigationFor(user, 'consultant') : []}>
      <RouteReadyBoundary><Outlet /></RouteReadyBoundary>
    </AppShell>
  );
}
