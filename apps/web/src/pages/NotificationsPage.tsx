import CampaignRounded from '@mui/icons-material/CampaignRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import { Alert, Avatar, Box, Button, Chip, Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export type PortalNotification = { id: string; type: string; category: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
type NotificationPage = { notifications: PortalNotification[]; unread: number; hasMore: boolean; nextCursor: string | null };

export function notificationPresentation(category: string) {
  switch (category.toUpperCase()) {
    case 'SECURITY': return { label: 'Security', icon: <SecurityRounded /> };
    case 'DOCUMENT':
    case 'DOCUMENTS': return { label: 'Documents', icon: <DescriptionRounded /> };
    case 'SUPPORT': return { label: 'Support', icon: <SupportAgentRounded /> };
    case 'OPERATIONAL': return { label: 'Account update', icon: <CampaignRounded /> };
    default: return { label: 'Update', icon: <NotificationsNoneRounded /> };
  }
}

function NotificationGroup({ title, items, onOpen }: { title: string; items: PortalNotification[]; onOpen: (item: PortalNotification) => void }) {
  if (!items.length) return null;
  return <Stack spacing={1.25}>
    <Typography variant="h3">{title}</Typography>
    {items.map((notification) => {
      const presentation = notificationPresentation(notification.category);
      return <Box key={notification.id} component="button" type="button" onClick={() => onOpen(notification)} sx={{ width: '100%', textAlign: 'left', color: 'inherit', font: 'inherit', border: '1px solid', borderColor: notification.readAt ? 'divider' : 'primary.main', bgcolor: notification.readAt ? 'transparent' : 'rgba(66,211,242,.07)', borderRadius: 3, p: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' }, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Avatar sx={{ bgcolor: notification.readAt ? 'action.selected' : 'primary.main', color: notification.readAt ? 'text.primary' : 'primary.contrastText' }}>{presentation.icon}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
              <Typography sx={{ fontWeight: notification.readAt ? 750 : 900 }}>{notification.title}</Typography>
              <Typography variant="caption" color="text.secondary">{new Date(notification.createdAt).toLocaleString()}</Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{notification.body}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}><Chip size="small" variant="outlined" label={presentation.label} />{!notification.readAt && <Chip size="small" color="primary" label="New" />}</Stack>
          </Box>
        </Stack>
      </Box>;
    })}
  </Stack>;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'SUPPORT'>('ALL');
  const filterQuery = filter === 'UNREAD' ? '&unreadOnly=true' : filter === 'SUPPORT' ? '&category=SUPPORT' : '';
  const query = useInfiniteQuery({
    queryKey: ['notifications', 'history', filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiRequest<NotificationPage>(`/api/v1/notifications?limit=20${filterQuery}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const markAll = useMutation({ mutationFn: () => apiRequest<void>('/api/v1/notifications/read-all', { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const markOne = useMutation({ mutationFn: (id: string) => apiRequest(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const open = async (notification: PortalNotification) => {
    if (!notification.readAt) await markOne.mutateAsync(notification.id);
    if (notification.link) navigate(notification.link);
  };
  if (query.isLoading) return <LoadingSkeleton />;
  const notifications = query.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unread = query.data?.pages[0]?.unread ?? 0;
  const fresh = notifications.filter((item) => !item.readAt);
  const earlier = notifications.filter((item) => item.readAt);
  return <Stack spacing={3}>
    <PageHeader eyebrow="PORTAL-41" title="Notifications" description="Important account, document, support, and security updates in one private inbox." actions={unread ? <Button variant="outlined" onClick={() => markAll.mutate()} disabled={markAll.isPending}>{markAll.isPending ? 'Updating…' : 'Mark all read'}</Button> : undefined} />
    <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, value) => value && setFilter(value)} aria-label="Notification filter">
      <ToggleButton value="ALL">All</ToggleButton>
      <ToggleButton value="UNREAD">Unread</ToggleButton>
      <ToggleButton value="SUPPORT">Support</ToggleButton>
    </ToggleButtonGroup>
    {(markAll.isError || markOne.isError) && <Alert severity="error">The notification update failed. Your history is unchanged; please retry.</Alert>}
    {query.isError && <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>Notifications are temporarily unavailable.</Alert>}
    {!query.isError && <SectionCard>
      {!notifications.length ? <Box sx={{ py: 6, textAlign: 'center' }}><NotificationsNoneRounded color="primary" sx={{ fontSize: 44 }} /><Typography variant="h3" sx={{ mt: 1 }}>You’re all caught up</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>New account and service updates will appear here.</Typography></Box> : <Stack spacing={3} divider={<Divider />}>
        <NotificationGroup title="New" items={fresh} onOpen={(item) => void open(item)} />
        <NotificationGroup title="Earlier" items={earlier} onOpen={(item) => void open(item)} />
        {query.hasNextPage && <Button variant="outlined" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ alignSelf: 'center' }}>{query.isFetchingNextPage ? 'Loading…' : 'Load earlier notifications'}</Button>}
      </Stack>}
    </SectionCard>}
  </Stack>;
}
