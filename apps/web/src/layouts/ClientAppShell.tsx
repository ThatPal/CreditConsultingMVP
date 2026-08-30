import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';
import { clientNavigation } from './navigation';
export function ClientAppShell() {
  return (
    <AppShell role="client" items={clientNavigation}>
      <Outlet />
    </AppShell>
  );
}
