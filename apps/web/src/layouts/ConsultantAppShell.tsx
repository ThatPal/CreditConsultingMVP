import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';
import { consultantNavigation } from './navigation';
export function ConsultantAppShell() {
  return (
    <AppShell role="consultant" items={consultantNavigation}>
      <Outlet />
    </AppShell>
  );
}
