import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent, type PropsWithChildren } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { designTokens } from '../theme';
import type { NavigationItem, ShellKind } from './navigation';

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
  const primaryItems = items.filter((item) => item.section === 'primary');
  const utilityItems = items.filter((item) => item.section === 'utility');
  const renderItems = (navigationItems: NavigationItem[]) =>
    navigationItems.map(({ label, path, icon: Icon }) => (
      <ListItemButton
        key={path}
        component={NavLink}
        to={path}
        end={path === '/app' || path === '/crm' || path === '/admin'}
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
          '&.active': {
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
            <Typography sx={{ fontSize: dense ? 13.5 : 14.5, fontWeight: 700 }}>
              {label}
            </Typography>
          }
        />
      </ListItemButton>
    ));
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
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
          {role === 'client' ? 'Plan' : role === 'consultant' ? 'Workspace' : 'Administration'}
        </Typography>
        {renderItems(primaryItems)}
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
            <Typography variant="body2" color="text.secondary" sx={{ ml: { xs: 'auto', lg: 0 } }}>
              {shellLabel}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
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
