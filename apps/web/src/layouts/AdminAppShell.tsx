import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppShell } from './AppShell';
import { navigationFor } from './navigation';

export function AdminAppShell() {
  const { user } = useAuth();
  return (
    <AppShell role="admin" items={user ? navigationFor(user, 'admin') : []}>
      <Outlet />
    </AppShell>
  );
}
