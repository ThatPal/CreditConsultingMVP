import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HelpRounded from '@mui/icons-material/HelpRounded';
import IntegrationInstructionsRounded from '@mui/icons-material/IntegrationInstructionsRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import type { CurrentUser } from '../auth/api';

export type ShellKind = 'client' | 'consultant' | 'admin';
export type NavigationGroup =
  | 'Overview'
  | 'Identity & security'
  | 'Commerce'
  | 'Card intelligence'
  | 'Automation & AI'
  | 'Communications'
  | 'Integrations'
  | 'Data & governance'
  | 'Reporting & settings'
  | 'Utilities';
export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: SvgIconComponent;
  shell: ShellKind;
  section: 'primary' | 'utility';
  capability?: string;
  group?: NavigationGroup;
  owns?: string[];
};
const n = (value: NavigationItem) => value;
const registry: NavigationItem[] = [
  n({
    id: 'portal-home',
    label: 'Home',
    path: '/app',
    icon: DashboardRounded,
    shell: 'client',
    section: 'primary',
    owns: ['/app'],
  }),
  n({
    id: 'portal-journey',
    label: 'Journey',
    path: '/app/journey',
    icon: TaskAltRounded,
    shell: 'client',
    section: 'primary',
  }),
  n({
    id: 'portal-credit',
    label: 'Credit Center',
    path: '/app/credit-center',
    icon: CreditScoreRounded,
    shell: 'client',
    section: 'primary',
    owns: ['/app/credit-center', '/app/plan'],
  }),
  n({
    id: 'portal-cards',
    label: 'Cards',
    path: '/app/cards',
    icon: CreditCardRounded,
    shell: 'client',
    section: 'primary',
  }),
  n({
    id: 'portal-rounds',
    label: 'Application Rounds',
    path: '/app/application-rounds',
    icon: CalendarMonthRounded,
    shell: 'client',
    section: 'primary',
    owns: ['/app/application-rounds', '/app/rounds'],
  }),
  n({
    id: 'portal-major',
    label: 'Major Readiness',
    path: '/app/major-readiness',
    icon: TaskAltRounded,
    shell: 'client',
    section: 'primary',
  }),
  n({
    id: 'portal-services',
    label: 'Services',
    path: '/app/services',
    icon: StorefrontRounded,
    shell: 'client',
    section: 'primary',
    owns: ['/app/services', '/app/checkout'],
  }),
  n({
    id: 'portal-support',
    label: 'Support',
    path: '/app/support',
    icon: HelpRounded,
    shell: 'client',
    section: 'primary',
  }),
  n({
    id: 'portal-documents',
    label: 'Documents',
    path: '/app/documents',
    icon: DescriptionRounded,
    shell: 'client',
    section: 'utility',
  }),
  n({
    id: 'portal-notifications',
    label: 'Notifications',
    path: '/app/notifications',
    icon: NotificationsNoneRounded,
    shell: 'client',
    section: 'utility',
  }),
  n({
    id: 'portal-account',
    label: 'Account',
    path: '/app/account',
    icon: AccountCircleRounded,
    shell: 'client',
    section: 'utility',
  }),
  n({
    id: 'crm-dashboard',
    label: 'Dashboard',
    path: '/crm',
    icon: DashboardRounded,
    shell: 'consultant',
    section: 'primary',
    owns: ['/crm'],
  }),
  n({
    id: 'crm-work',
    label: 'Work Queue',
    path: '/crm/work-queue',
    icon: TaskAltRounded,
    shell: 'consultant',
    section: 'primary',
  }),
  n({
    id: 'crm-clients',
    label: 'Clients',
    path: '/crm/clients',
    icon: GroupsRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'client.read',
    owns: ['/crm/clients', '/crm/reviews'],
  }),
  n({
    id: 'crm-cards',
    label: 'Cards research',
    path: '/crm/card-catalog',
    icon: CreditCardRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'catalog.read',
    owns: ['/crm/card-catalog', '/crm/card-insights'],
  }),
  n({
    id: 'crm-calendar',
    label: 'Calendar & Live',
    path: '/crm/calendar',
    icon: CalendarMonthRounded,
    shell: 'consultant',
    section: 'primary',
    owns: ['/crm/calendar', '/crm/sessions', '/crm/live-sessions'],
  }),
  n({
    id: 'crm-support',
    label: 'Support',
    path: '/crm/support',
    icon: HelpRounded,
    shell: 'consultant',
    section: 'primary',
    capability: 'support.manage',
  }),
  n({
    id: 'crm-account',
    label: 'Account',
    path: '/crm/account',
    icon: AccountCircleRounded,
    shell: 'consultant',
    section: 'utility',
  }),
  n({
    id: 'admin-home',
    label: 'Operations overview',
    path: '/admin',
    icon: DashboardRounded,
    shell: 'admin',
    section: 'primary',
    group: 'Overview',
    owns: ['/admin'],
  }),
  n({
    id: 'admin-users',
    label: 'Users & staff',
    path: '/admin/users',
    icon: GroupsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Identity & security',
  }),
  n({
    id: 'admin-access-grants',
    label: 'Access grants',
    path: '/admin/access-grants',
    icon: SecurityRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Identity & security',
  }),
  n({
    id: 'admin-security-events',
    label: 'Security events',
    path: '/admin/security-events',
    icon: SecurityRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'audit.read_platform',
    group: 'Identity & security',
  }),
  n({
    id: 'admin-services',
    label: 'Service products',
    path: '/admin/services',
    icon: StorefrontRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'commerce.manage',
    group: 'Commerce',
  }),
  n({
    id: 'admin-payments',
    label: 'Payments & gateways',
    path: '/admin/payments',
    icon: CreditCardRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'payment.read',
    group: 'Commerce',
    owns: [
      '/admin/payments',
      '/admin/integrations/paypal',
      '/admin/integrations/stripe',
      '/admin/integrations/bofa',
    ],
  }),
  n({
    id: 'admin-card-catalog',
    label: 'Card catalog',
    path: '/admin/card-catalog',
    icon: CreditCardRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'catalog.read',
    group: 'Card intelligence',
  }),
  n({
    id: 'admin-card-insights',
    label: 'Card insights',
    path: '/admin/card-insights',
    icon: CreditScoreRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'catalog.manage',
    group: 'Card intelligence',
  }),
  n({
    id: 'admin-ai-jobs',
    label: 'AI jobs',
    path: '/admin/ai/jobs',
    icon: TaskAltRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Automation & AI',
  }),
  n({
    id: 'admin-ai-processes',
    label: 'AI processes',
    path: '/admin/ai/processes',
    icon: AdminPanelSettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Automation & AI',
  }),
  n({
    id: 'admin-workflow-rules',
    label: 'Workflow rules',
    path: '/admin/workflow-rules',
    icon: TaskAltRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Automation & AI',
  }),
  n({
    id: 'admin-notifications',
    label: 'Notification operations',
    path: '/admin/notification-operations',
    icon: NotificationsNoneRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Communications',
  }),
  n({
    id: 'admin-integrations',
    label: 'Non-payment integrations',
    path: '/admin/integrations',
    icon: IntegrationInstructionsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Integrations',
  }),
  n({
    id: 'admin-sources',
    label: 'Source registry',
    path: '/admin/sources',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Data & governance',
  }),
  n({
    id: 'admin-retention',
    label: 'Retention',
    path: '/admin/retention',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Data & governance',
  }),
  n({
    id: 'admin-audit-events',
    label: 'Audit history',
    path: '/admin/audit-events',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'audit.read_platform',
    group: 'Data & governance',
  }),
  n({
    id: 'admin-reports',
    label: 'Reports',
    path: '/admin/reports',
    icon: DescriptionRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Reporting & settings',
  }),
  n({
    id: 'admin-settings',
    label: 'Settings',
    path: '/admin/settings',
    icon: SettingsRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Reporting & settings',
  }),
  n({
    id: 'admin-scheduled-jobs',
    label: 'Scheduled jobs',
    path: '/admin/scheduled-jobs',
    icon: CalendarMonthRounded,
    shell: 'admin',
    section: 'primary',
    capability: 'settings.manage',
    group: 'Utilities',
  }),
  n({
    id: 'admin-system-health',
    label: 'System health',
    path: '/admin/system-health',
    icon: TaskAltRounded,
    shell: 'admin',
    section: 'primary',
    group: 'Utilities',
  }),
  n({
    id: 'admin-account',
    label: 'Account',
    path: '/admin/account',
    icon: AccountCircleRounded,
    shell: 'admin',
    section: 'utility',
  }),
];
export function navigationFor(user: CurrentUser, shell: ShellKind) {
  const role = shell === 'client' ? 'CLIENT' : shell === 'consultant' ? 'CONSULTANT' : 'ADMIN';
  if (user.role !== role) return [];
  const caps = new Set(user.capabilities ?? []);
  return registry.filter((x) => x.shell === shell && (!x.capability || caps.has(x.capability)));
}
export function activeNavigationId(items: NavigationItem[], pathname: string) {
  return items
    .flatMap((entry) => (entry.owns ?? [entry.path]).map((prefix) => ({ entry, prefix })))
    .filter(
      ({ prefix }) =>
        pathname === prefix ||
        (!['/app', '/crm', '/admin'].includes(prefix) && pathname.startsWith(`${prefix}/`)),
    )
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.entry.id;
}
export function validateNavigationRegistry() {
  const ids = new Set<string>(),
    paths = new Set<string>();
  return registry.every((x) => {
    const valid = !!x.id && !ids.has(x.id) && !paths.has(x.path);
    ids.add(x.id);
    paths.add(x.path);
    return valid;
  });
}
if (!validateNavigationRegistry()) throw new Error('Navigation registry is invalid');
