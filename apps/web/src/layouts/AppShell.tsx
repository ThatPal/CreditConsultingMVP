import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import {
  AppBar,
  Avatar,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Link as MuiLink,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type MouseEvent, type PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { designTokens } from '../theme';
import {
  activeNavigationId,
  type NavigationItem,
  type NavigationGroup,
  type ShellKind,
} from './navigation';

const sidebarWidth = 264;
type AppNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ px: compact ? 0 : 2.5, py: 2.5, alignItems: 'center', flexShrink: 0 }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '12px',
          background: designTokens.gradient.brand,
          display: 'grid',
          placeItems: 'center',
          color: designTokens.color.canvas,
          fontWeight: 950,
        }}
      >
        C
      </Box>
      {!compact && (
        <Box>
          <Typography sx={{ fontWeight: 850, letterSpacing: '-0.03em' }}>
            Credit Strategy
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Private advisory platform
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function Sidebar({
  items,
  dense,
  role,
  onNavigate,
}: {
  items: NavigationItem[];
  dense: boolean;
  role: ShellKind;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const activeId = activeNavigationId(items, pathname);
  const primaryItems = items.filter((item) => item.section === 'primary');
  const utilityItems = items.filter((item) => item.section === 'utility');
  const renderItems = (navigationItems: NavigationItem[]) =>
    navigationItems.map(({ id, label, path, icon: Icon }) => (
      <ListItemButton
        key={path}
        component={Link}
        to={path}
        selected={id === activeId}
        aria-current={id === activeId ? 'page' : undefined}
        onClick={onNavigate}
        sx={{
          mb: 0.5,
          minHeight: dense ? 42 : 48,
          borderRadius: `${designTokens.radius.sm}px`,
          color: 'text.secondary',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            width: 3,
            height: 22,
            borderRadius: 4,
            background: designTokens.gradient.brand,
            position: 'absolute',
            left: 0,
            opacity: 0,
          },
          '&.Mui-selected': {
            color: 'text.primary',
            bgcolor: 'rgba(66, 211, 242, 0.08)',
            backgroundImage: designTokens.gradient.active,
            '&::before': { opacity: 1 },
            '& .MuiListItemIcon-root': { color: 'primary.main' },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography sx={{ fontSize: dense ? 13.5 : 14.5, fontWeight: 700 }}>{label}</Typography>
          }
        />
      </ListItemButton>
    ));
  const adminGroups: NavigationGroup[] = [
    'Overview',
    'Identity & security',
    'Commerce',
    'Card intelligence',
    'Automation & AI',
    'Communications',
    'Integrations',
    'Data & governance',
    'Reporting & settings',
    'Utilities',
  ];
  const primaryNavigation =
    role === 'admin'
      ? adminGroups.map((group) => {
          const groupItems = primaryItems.filter((item) => item.group === group);
          return groupItems.length ? (
            <Box key={group} sx={{ mt: group === 'Overview' ? 0 : 1.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
                {group}
              </Typography>
              {renderItems(groupItems)}
            </Box>
          ) : null;
        })
      : renderItems(primaryItems);
  return (
    <Box
      sx={{
        width: sidebarWidth,
        height: '100%',
        bgcolor: designTokens.color.sidebar,
        backdropFilter: 'blur(18px)',
        borderRight: `1px solid ${designTokens.color.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Brand />
      <List
        component="nav"
        aria-label={`${role === 'client' ? 'Client' : role === 'consultant' ? 'Consultant' : 'Admin'} navigation`}
        sx={{ px: 1.5, py: 1, flex: 1, minHeight: 0, overflowY: 'auto' }}
      >
        {role !== 'admin' && (
          <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
            {role === 'client' ? 'Plan' : 'Workspace'}
          </Typography>
        )}
        {primaryNavigation}
        {utilityItems.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
              Utilities
            </Typography>
            {renderItems(utilityItems)}
          </>
        )}
      </List>
      <Box
        sx={{
          flexShrink: 0,
          p: 2,
          bgcolor: designTokens.color.sidebar,
          borderTop: `1px solid ${designTokens.color.border}`,
        }}
      >
        <Box
          sx={{
            p: 2,
            border: `1px solid ${designTokens.color.border}`,
            borderRadius: `${designTokens.radius.md}px`,
            background: designTokens.gradient.subtle,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Secure workspace
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>
            Your strategy stays private.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function AppShell({
  items,
  role,
  children,
}: PropsWithChildren<{ items: NavigationItem[]; role: ShellKind }>) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [open, setOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<{ notifications: AppNotification[]; unread: number }>('/api/v1/notifications'),
  });
  const markAllRead = useMutation({
    mutationFn: () => apiRequest<void>('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt)
      await apiRequest(`/api/v1/notifications/${notification.id}/read`, { method: 'PATCH' });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setNotificationAnchor(null);
    if (notification.link) navigate(notification.link);
  };
  const dense = role !== 'client';
  const shellLabel =
    role === 'client'
      ? 'Client portal'
      : role === 'consultant'
        ? 'Consultant CRM'
        : 'Admin operations';
  const accountPath =
    role === 'client' ? '/app/account' : role === 'consultant' ? '/crm/account' : '/admin/account';
  const closeAccountMenu = () => {
    const trigger = accountAnchor;
    setAccountAnchor(null);
    requestAnimationFrame(() => trigger?.focus());
  };
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unread = notificationsQuery.data?.unread ?? 0;
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(clientSearch.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [clientSearch]);
  type ClientResult = {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
    _count?: { workItems: number };
  };
  const clientSearchQuery = useQuery({
    queryKey: ['shell-client-search', debouncedSearch],
    queryFn: () =>
      apiRequest<{ clients: ClientResult[] }>(
        `/api/v1/consultant/client-context?search=${encodeURIComponent(debouncedSearch)}&status=ACTIVE&page=1&pageSize=8`,
      ),
    enabled: role === 'consultant' && debouncedSearch.length >= 2,
  });
  type QueueSummary = {
    total: number;
    items?: Array<{ id: string; priority?: string; title?: string }>;
  };
  const urgencyQuery = useQuery({
    queryKey: ['shell-urgent-work'],
    queryFn: () =>
      apiRequest<QueueSummary>('/api/v1/consultant/work-queue?priority=URGENT&page=1&pageSize=1'),
    enabled: role === 'consultant',
    refetchInterval: 30_000,
  });
  const contextualClientId =
    role === 'consultant' ? location.pathname.match(/^\/crm\/clients\/([^/]+)/)?.[1] : undefined;
  type ContextualClient = {
    client: {
      id: string;
      firstName: string;
      lastName: string;
      status: string;
      _count?: { workItems: number };
    };
  };
  const contextualClientQuery = useQuery({
    queryKey: ['shell-client-context', contextualClientId],
    queryFn: () =>
      apiRequest<ContextualClient>(`/api/v1/consultant/client-context/${contextualClientId}`),
    enabled: Boolean(contextualClientId),
    retry: false,
  });
  const clientOptions = useMemo(
    () => clientSearchQuery.data?.clients ?? [],
    [clientSearchQuery.data],
  );
  const activeItem = items.find(
    (entry) => entry.id === activeNavigationId(items, location.pathname),
  );
  const finalSegment = location.pathname.split('/').filter(Boolean).at(-1);
  const pathDetail =
    finalSegment && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(finalSegment)
      ? location.pathname.startsWith('/crm/clients/')
        ? 'Client record'
        : 'Record detail'
      : finalSegment?.replaceAll('-', ' ');
  return (
    <Box
      sx={{
        minHeight: '100vh',
        height: { lg: '100vh' },
        display: 'flex',
        overflow: { lg: 'hidden' },
      }}
    >
      <Box
        component="aside"
        sx={{ width: { lg: sidebarWidth }, height: { lg: '100vh' }, flexShrink: 0 }}
      >
        {desktop ? (
          <Sidebar items={items} dense={dense} role={role} />
        ) : (
          <Drawer
            open={open}
            onClose={() => setOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: { bgcolor: 'transparent' } } }}
          >
            <Sidebar items={items} dense={dense} role={role} onNavigate={() => setOpen(false)} />
          </Drawer>
        )}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: { lg: '100vh' },
          overflow: { lg: 'hidden' },
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: designTokens.color.topbar,
            backdropFilter: 'blur(18px)',
            borderBottom: `1px solid ${designTokens.color.border}`,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 68, sm: 76 } }}>
            <IconButton
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              sx={{ display: { lg: 'none' }, mr: 1 }}
            >
              <MenuRounded />
            </IconButton>
            <Box sx={{ display: { lg: 'none' } }}>
              <Brand compact />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ml: { xs: 'auto', lg: 0 }, display: { xs: 'none', sm: 'block' } }}
            >
              {shellLabel}
            </Typography>
            {role === 'consultant' && (
              <Autocomplete
                size="small"
                options={clientOptions}
                loading={clientSearchQuery.isFetching}
                filterOptions={(options) => options}
                inputValue={clientSearch}
                value={null}
                onInputChange={(_event, value) => setClientSearch(value)}
                getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                onChange={(_event, client) => {
                  if (client) {
                    setClientSearch('');
                    navigate(`/crm/clients/${client.id}`);
                  }
                }}
                noOptionsText={
                  debouncedSearch.length < 2
                    ? 'Type at least 2 characters'
                    : 'No authorized clients found'
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography sx={{ fontWeight: 800 }}>
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.user.email}
                        {option._count ? ` · ${option._count.workItems} active items` : ''}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Find an authorized client" />
                )}
                sx={{ ml: { sm: 2 }, width: { xs: 180, sm: 300 }, maxWidth: '38vw' }}
              />
            )}
            <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
              {role === 'consultant' && (
                <>
                  <IconButton
                    component={Link}
                    to="/crm/work-queue"
                    color={(urgencyQuery.data?.total ?? 0) > 0 ? 'warning' : 'default'}
                    aria-label={`${urgencyQuery.data?.total ?? 0} urgent work items`}
                    sx={{ display: { md: 'none' } }}
                  >
                    <Badge badgeContent={urgencyQuery.data?.total ?? 0} color="warning">
                      <BoltRounded />
                    </Badge>
                  </IconButton>
                  <Button
                    component={Link}
                    to="/crm/work-queue"
                    color={(urgencyQuery.data?.total ?? 0) > 0 ? 'warning' : 'inherit'}
                    startIcon={<BoltRounded />}
                    aria-label={`${urgencyQuery.data?.total ?? 0} urgent work items`}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                  >
                    {(urgencyQuery.data?.total ?? 0) > 0
                      ? `${urgencyQuery.data?.total} urgent`
                      : 'Work clear'}
                  </Button>
                </>
              )}
              <Tooltip title="Notifications">
                <IconButton
                  aria-label="Notifications"
                  onClick={(event: MouseEvent<HTMLElement>) =>
                    setNotificationAnchor(event.currentTarget)
                  }
                >
                  <Badge color="error" badgeContent={unread} max={99} invisible={unread === 0}>
                    <NotificationsNoneRounded />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Account">
                <IconButton
                  aria-label="Account profile"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(accountAnchor)}
                  onClick={(event) => setAccountAnchor(event.currentTarget)}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: 'rgba(155, 120, 255, 0.2)',
                      color: 'secondary.light',
                    }}
                  >
                    <AccountCircleRounded fontSize="small" />
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>
        {contextualClientId && (
          <Box
            component="nav"
            aria-label="Current client workspace"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              background:
                'linear-gradient(90deg, rgba(29,211,176,.14), rgba(66,211,242,.06) 52%, transparent)',
              px: { xs: 2, sm: 3 },
              py: 1.25,
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              sx={{ gap: 1.25, alignItems: { md: 'center' }, maxWidth: 1600, mx: 'auto' }}
            >
              <Box sx={{ minWidth: 210 }}>
                <Typography variant="caption" color="text.secondary">
                  Current client · context stays with this workbench
                </Typography>
                <Typography sx={{ fontWeight: 850 }}>
                  {contextualClientQuery.data
                    ? `${contextualClientQuery.data.client.firstName} ${contextualClientQuery.data.client.lastName}`
                    : contextualClientQuery.isError
                      ? 'Client context unavailable'
                      : 'Loading client context…'}
                </Typography>
              </Box>
              {contextualClientQuery.data && (
                <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={contextualClientQuery.data.client.status.replaceAll('_', ' ')}
                  />
                  {contextualClientQuery.data.client._count && (
                    <Chip
                      size="small"
                      color={
                        contextualClientQuery.data.client._count.workItems ? 'warning' : 'default'
                      }
                      label={`${contextualClientQuery.data.client._count.workItems} active work`}
                    />
                  )}
                </Stack>
              )}
              <Stack
                direction="row"
                sx={{ gap: 0.5, ml: { md: 'auto' }, overflowX: 'auto', pb: 0.25 }}
              >
                {([
                  ['Overview', `/crm/clients/${contextualClientId}`],
                  ['Journey', `/crm/clients/${contextualClientId}#journey`],
                  ['Credit Center', `/crm/clients/${contextualClientId}/credit-center`],
                  ['Plan', `/crm/clients/${contextualClientId}/plan`],
                  ['Cards', `/crm/clients/${contextualClientId}/cards`],
                  ['Timeline', `/crm/clients/${contextualClientId}#timeline`],
                  ['Support', `/crm/clients/${contextualClientId}#support`],
                ] as const).map(([label, to]) => (
                  <Button
                    key={label}
                    component={Link}
                    to={to}
                    size="small"
                    color="inherit"
                    sx={{ flexShrink: 0 }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Box>
        )}
        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={closeAccountMenu}
          slotProps={{ list: { 'aria-label': 'Account menu' } }}
        >
          <MenuItem
            onClick={() => {
              setAccountAnchor(null);
              navigate(accountPath);
            }}
          >
            Account
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAccountAnchor(null);
              navigate(`${accountPath}/security`);
            }}
          >
            Security & sessions
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={async () => {
              setAccountAnchor(null);
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </MenuItem>
        </Menu>
        <Popover
          open={Boolean(notificationAnchor)}
          anchorEl={notificationAnchor}
          onClose={() => setNotificationAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)', mt: 1 } } }}
        >
          <Stack direction="row" sx={{ px: 2, py: 1.5, alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4">Notifications</Typography>
              <Typography variant="caption" color="text.secondary">
                {unread ? `${unread} unread` : 'You’re all caught up'}
              </Typography>
            </Box>
            {unread > 0 && (
              <Button size="small" onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            )}
            {role === 'client' && (
              <Button
                component={Link}
                to="/app/notifications"
                size="small"
                onClick={() => setNotificationAnchor(null)}
              >
                View all
              </Button>
            )}
          </Stack>
          <Divider />
          <Box sx={{ maxHeight: 440, overflowY: 'auto' }}>
            {!notifications.length ? (
              <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
                <NotificationsNoneRounded color="primary" sx={{ fontSize: 38 }} />
                <Typography sx={{ mt: 1, fontWeight: 800 }}>No notifications yet</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {notifications.map((notification, index) => (
                  <Box key={notification.id}>
                    {index > 0 && <Divider />}
                    <ListItemButton
                      onClick={() => void openNotification(notification)}
                      sx={{
                        alignItems: 'flex-start',
                        px: 2,
                        py: 1.5,
                        bgcolor: notification.readAt ? 'transparent' : 'rgba(66,211,242,.07)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: notification.readAt ? 'transparent' : 'primary.main',
                          mt: 0.8,
                          mr: 1.25,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: notification.readAt ? 700 : 900 }}>
                          {notification.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {notification.body}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(notification.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Popover>
        {activeItem && (
          <Box
            component="nav"
            aria-label="Page context"
            sx={{
              px: { xs: 2, sm: 3, xl: 5 },
              py: 1,
              borderBottom: `1px solid ${designTokens.color.border}`,
              bgcolor: 'rgba(8,18,36,.68)',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              <MuiLink component={Link} to={activeItem.path} color="inherit" underline="hover">
                {activeItem.label}
              </MuiLink>
              {pathDetail && location.pathname !== activeItem.path ? ` / ${pathDetail}` : ''}
            </Typography>
          </Box>
        )}
        <Box
          component="main"
          sx={{
            width: '100%',
            minHeight: 0,
            flex: { lg: 1 },
            overflowY: { lg: 'auto' },
            p: { xs: 2, sm: 3, xl: 5 },
            maxWidth: dense ? 1720 : 1500,
            mx: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
