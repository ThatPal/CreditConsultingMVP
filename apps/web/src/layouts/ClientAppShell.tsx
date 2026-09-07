import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';
import { navigationFor } from './navigation';
import { useAuth } from '../auth/AuthProvider';
import { RouteReadyBoundary } from '../components/common/RouteReadyBoundary';
export function ClientAppShell() {
  const { user } = useAuth();
  return (
    <AppShell role="client" items={user ? navigationFor(user, 'client') : []}>
      <RouteReadyBoundary><Outlet /></RouteReadyBoundary>
    </AppShell>
  );
}
