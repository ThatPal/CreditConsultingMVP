import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HelpRounded from '@mui/icons-material/HelpRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import VideoCallRounded from '@mui/icons-material/VideoCallRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import type { CurrentUser } from '../auth/api';

export type ShellKind = 'client' | 'consultant' | 'admin';
export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: SvgIconComponent;
  shell: ShellKind;
  section: 'primary' | 'utility';
  capability?: string;
  status: 'available' | 'foundation';
  group?: 'Overview' | 'Identity & security' | 'Commerce' | 'Catalog' | 'Integrations';
};

const registry: NavigationItem[] = [
  {
    id: 'portal-home',
    label: 'Home',
    path: '/app',
    icon: DashboardRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-journey',
    label: 'Journey',
    path: '/app/journey',
    icon: TaskAltRounded,
    shell: 'client',
    section: 'primary',
    status: 'foundation',
  },
  {
    id: 'portal-plan',
    label: 'Plan',
    path: '/app/plan',
    icon: TaskAltRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-credit',
    label: 'Credit Center',
    path: '/app/credit-center',
    icon: CreditScoreRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-cards',
    label: 'Cards',
    path: '/app/cards',
    icon: CreditCardRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-services',
    label: 'Services',
    path: '/app/services',
    icon: StorefrontRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-support',
    label: 'Support',
    path: '/app/support',
    icon: HelpRounded,
    shell: 'client',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'portal-documents',
    label: 'Documents',
    path: '/app/documents',
    icon: DescriptionRounded,
    shell: 'client',
    section: 'utility',
    status: 'available',
  },
  {
    id: 'portal-notifications',
    label: 'Notifications',
    path: '/app/notifications',
    icon: NotificationsNoneRounded,
    shell: 'client',
    section: 'utility',
    status: 'available',
  },
  {
    id: 'portal-account',
    label: 'Account',
    path: '/app/account',
    icon: AccountCircleRounded,
    shell: 'client',
    section: 'utility',
    status: 'available',
  },
  {
    id: 'crm-dashboard',
    label: 'Dashboard',
    path: '/crm',
    icon: DashboardRounded,
    shell: 'consultant',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'crm-work',
    label: 'Work Queue',
    path: '/crm/work-queue',
    icon: TaskAltRounded,
    shell: 'consultant',
    section: 'primary',
    status: 'available',
  },
  {
    id: 'crm-clients',
    label: 'Clients',
    path: '/crm/clients',
    icon: GroupsRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'client.read',
    status: 'available',
  },
  {
    id: 'crm-sessions',
    label: 'Live Sessions',
    path: '/crm/sessions',
    icon: VideoCallRounded,
    shell: 'consultant',
    section: 'primary',
    status: 'foundation',
  },
  {
    id: 'crm-card-catalog',
    label: 'Card Catalog',
    path: '/crm/card-catalog',
    icon: CreditCardRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'catalog.read',
    status: 'available',
  },
  {
    id: 'crm-card-insights',
    label: 'Card Insights',
    path: '/crm/card-insights',
    icon: CreditScoreRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'catalog.manage',
    status: 'available',
  },
  {
    id: 'crm-support',
    label: 'Support',
    path: '/crm/support',
    icon: SupportAgentRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'support.manage',
    status: 'available',
  },
  {
    id: 'crm-calendar',
    label: 'Calendar',
    path: '/crm/calendar',
    icon: CalendarMonthRounded,
    shell: 'consultant',
    section: 'primary',
    status: 'foundation',
  },
  {
    id: 'crm-account',
    label: 'Account',
    path: '/crm/account',
    icon: AccountCircleRounded,
    shell: 'consultant',
    section: 'utility',
    status: 'available',
  },
  {
    id: 'admin-home',
    label: 'Admin Home',
    path: '/admin',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    status: 'foundation',
    group: 'Overview',
  },
  {
    id: 'admin-services',
    label: 'Services',
    path: '/admin/services',
    icon: StorefrontRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'commerce.manage',
    status: 'available',
    group: 'Commerce',
  },
  {
    id: 'admin-users',
    label: 'Users & staff',
    path: '/admin/users',
    icon: GroupsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Identity & security',
  },
  {
    id: 'admin-access-grants',
    label: 'Access grants',
    path: '/admin/access-grants',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Identity & security',
  },
  {
    id: 'admin-payments',
    label: 'Payments',
    path: '/admin/payments',
    icon: CreditCardRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'payment.read',
    status: 'available',
    group: 'Commerce',
  },
  {
    id: 'admin-audit-events',
    label: 'Audit history',
    path: '/admin/audit-events',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'audit.read_platform',
    status: 'available',
    group: 'Identity & security',
  },
  {
    id: 'admin-ai-jobs',
    label: 'AI jobs',
    path: '/admin/ai/jobs',
    icon: TaskAltRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-ai-processes',
    label: 'AI processes',
    path: '/admin/ai/processes',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-sources',
    label: 'Source registry',
    path: '/admin/sources',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-workflow-rules',
    label: 'Workflow rules',
    path: '/admin/workflow-rules',
    icon: TaskAltRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-notification-operations',
    label: 'Notifications',
    path: '/admin/notification-operations',
    icon: NotificationsNoneRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-integrations',
    label: 'Integrations',
    path: '/admin/integrations',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-scheduled-jobs',
    label: 'Scheduled jobs',
    path: '/admin/scheduled-jobs',
    icon: CalendarMonthRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-retention',
    label: 'Retention',
    path: '/admin/retention',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-reports',
    label: 'Reports',
    path: '/admin/reports',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    status: 'available',
    group: 'Overview',
  },
  {
    id: 'admin-security-events',
    label: 'Security events',
    path: '/admin/security-events',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'audit.read_platform',
    status: 'available',
    group: 'Identity & security',
  },
  {
    id: 'admin-paypal',
    label: 'PayPal gateway',
    path: '/admin/integrations/paypal',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'payment.read',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-card-catalog',
    label: 'Card Catalog',
    path: '/admin/card-catalog',
    icon: CreditCardRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'catalog.read',
    status: 'available',
    group: 'Catalog',
  },
  {
    id: 'admin-card-insights',
    label: 'Card Insights',
    path: '/admin/card-insights',
    icon: CreditScoreRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'catalog.manage',
    status: 'available',
    group: 'Catalog',
  },
  {
    id: 'admin-stripe',
    label: 'Stripe gateway',
    path: '/admin/integrations/stripe',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'payment.read',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-bofa',
    label: 'BofA Merchant Services',
    path: '/admin/integrations/bofa',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'payment.read',
    status: 'available',
    group: 'Integrations',
  },
  {
    id: 'admin-account',
    label: 'Account',
    path: '/admin/account',
    icon: AccountCircleRounded,
    shell: 'admin',
    section: 'utility',
    status: 'available',
  },
];

export function navigationFor(user: CurrentUser, shell: ShellKind): NavigationItem[] {
  const expectedRole =
    shell === 'client' ? 'CLIENT' : shell === 'consultant' ? 'CONSULTANT' : 'ADMIN';
  if (user.role !== expectedRole) return [];
  const capabilities = new Set(user.capabilities ?? []);
  return registry.filter(
    (item) => item.shell === shell && (!item.capability || capabilities.has(item.capability)),
  );
}

export function validateNavigationRegistry(): boolean {
  const ids = new Set<string>();
  const paths = new Set<string>();
  return registry.every((item) => {
    const base = item.shell === 'client' ? 'app' : item.shell === 'consultant' ? 'crm' : 'admin';
    const valid =
      Boolean(item.id && item.label && item.path.startsWith(`/${base}`)) &&
      !ids.has(item.id) &&
      !paths.has(item.path);
    ids.add(item.id);
    paths.add(item.path);
    return valid;
  });
}

if (!validateNavigationRegistry()) throw new Error('Navigation registry is invalid');
