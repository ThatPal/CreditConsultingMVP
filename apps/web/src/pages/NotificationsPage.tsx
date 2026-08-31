import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import { Alert, Box, Button, Chip, List, ListItemButton, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export type PortalNotification = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<{ notifications: PortalNotification[]; unread: number }>(
        '/api/v1/notifications?limit=100',
      ),
  });
  const markAll = useMutation({
    mutationFn: () => apiRequest<void>('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const open = async (notification: PortalNotification) => {
    if (!notification.readAt)
      await apiRequest(`/api/v1/notifications/${notification.id}/read`, { method: 'PATCH' });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (notification.link) navigate(notification.link);
  };

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return <Alert severity="error">Notifications are temporarily unavailable. Please retry.</Alert>;
  const notifications = query.data?.notifications ?? [];
  const unread = query.data?.unread ?? 0;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="PORTAL-41"
        title="Notifications"
        description="Account and service updates in one private, chronological inbox."
        actions={
          unread ? (
            <Button
              variant="outlined"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />
      <SectionCard>
        {!notifications.length ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <NotificationsNoneRounded color="primary" sx={{ fontSize: 44 }} />
            <Typography variant="h3" sx={{ mt: 1 }}>
              No notifications yet
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              New operational and security updates will appear here.
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Notifications">
            {notifications.map((notification) => (
              <ListItemButton
                key={notification.id}
                onClick={() => void open(notification)}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  alignItems: 'flex-start',
                  border: '1px solid',
                  borderColor: notification.readAt ? 'divider' : 'primary.main',
                  bgcolor: notification.readAt ? 'transparent' : 'rgba(66,211,242,.07)',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: notification.readAt ? 750 : 900 }}>
                      {notification.title}
                    </Typography>
                    {!notification.readAt && <Chip size="small" color="primary" label="Unread" />}
                  </Stack>
                  <Typography color="text.secondary">{notification.body}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(notification.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </SectionCard>
    </Stack>
  );
}
