import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppShell } from './AppShell';
import { navigationFor } from './navigation';
import { RouteReadyBoundary } from '../components/common/RouteReadyBoundary';

export function AdminAppShell() {
  const { user } = useAuth();
  return (
    <AppShell role="admin" items={user ? navigationFor(user, 'admin') : []}>
      <RouteReadyBoundary><Outlet /></RouteReadyBoundary>
    </AppShell>
  );
}
