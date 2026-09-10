import {
  Alert,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { humanizeCode } from '../components/common/labels';
import { CollectionSurface } from '../components/common/CollectionSurface';
type Template = {
  id: string;
  key: string;
  version: number;
  channel: string;
  subject: string | null;
  body: string;
  enabled: boolean;
  createdAt: string;
};
type Delivery = {
  id: string;
  channel: string;
  provider: string;
  status: string;
  attemptCount: number;
  failureCategory: string | null;
  createdAt: string;
  notification: { category: string; userId: string };
};
export function AdminNotificationsPage() {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiRequest<{ templates: Template[] }>('/api/v1/admin/notification-templates'),
  });
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const deliveries = useInfiniteQuery({
    queryKey: ['admin-deliveries', deliveryStatus],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      apiRequest<{ deliveries: Delivery[]; nextCursor: string | null }>(
        `/api/v1/admin/notification-deliveries?limit=50${deliveryStatus ? `&status=${deliveryStatus}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const deliveryRows = deliveries.data?.pages.flatMap((page) => page.deliveries) ?? [];
  const [key, setKey] = useState(''),
    [channel, setChannel] = useState('EMAIL'),
    [subject, setSubject] = useState(''),
    [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/notification-templates/${key}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          channel,
          subject: channel === 'EMAIL' ? subject : undefined,
          body,
          enabled: false,
          reason: 'Governed notification template version',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Notification operations"
        description="Versioned templates and provider-safe delivery diagnostics."
      />
      <Alert severity="info">
        Templates cannot reference password, token, secret, or card data. New versions are disabled.
      </Alert>
      {(templates.isError || deliveries.isError) && (
        <RecoveryState
          error={templates.error ?? deliveries.error}
          onRetry={() => {
            void templates.refetch();
            void deliveries.refetch();
          }}
        />
      )}
      <SectionCard>
        <Typography variant="h6">Create template version</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Template key" value={key} onChange={(e) => setKey(e.target.value)} />
          <TextField
            select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <MenuItem value="EMAIL">Email</MenuItem>
            <MenuItem value="IN_APP">In-app</MenuItem>
          </TextField>
          {channel === 'EMAIL' && (
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          )}
          <TextField
            multiline
            minRows={3}
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button disabled={!key || !body || create.isPending} onClick={() => create.mutate()}>
            Create disabled version
          </Button>
        </Stack>
      </SectionCard>
      <CollectionSurface
        title="Template version history"
        mode="history"
        busy={templates.isFetching}
        empty={!templates.isLoading && !templates.data?.templates.length}
      >
        <Stack divider={<Divider flexItem />}>
          {templates.data?.templates.map((t) => (
            <Stack
              data-collection-item
              tabIndex={0}
              key={t.id}
              sx={{ py: 1 }}
              direction="row"
              spacing={1}
            >
              <Typography>
                {t.key} v{t.version}
              </Typography>
              <Chip size="small" label={t.channel} />
              <Chip size="small" label={t.enabled ? 'Enabled' : 'Disabled'} />
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
      <CollectionSurface
        title="Delivery operations"
        mode="bounded"
        busy={deliveries.isFetching}
        empty={!deliveries.isLoading && !deliveryRows.length}
        controls={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
          >
            <TextField
              select
              size="small"
              label="Outcome"
              value={deliveryStatus}
              onChange={(event) => setDeliveryStatus(event.target.value)}
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="">All outcomes</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="PROCESSING">Processing</MenuItem>
              <MenuItem value="DELIVERED">Delivered</MenuItem>
              <MenuItem value="RETRY_SCHEDULED">Retry scheduled</MenuItem>
              <MenuItem value="FAILED">Failed</MenuItem>
            </TextField>
          </Stack>
        }
        footer={
          deliveries.hasNextPage ? (
            <Button
              variant="outlined"
              disabled={deliveries.isFetchingNextPage}
              onClick={() => void deliveries.fetchNextPage()}
            >
              {deliveries.isFetchingNextPage ? 'Loading…' : 'Load older deliveries'}
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              End of the loaded provider delivery history.
            </Typography>
          )
        }
      >
        <Stack divider={<Divider flexItem />}>
          {deliveryRows.map((d) => (
            <Stack data-collection-item tabIndex={0} key={d.id} sx={{ py: 1 }}>
              <Typography>
                {humanizeCode(d.notification.category)} · {humanizeCode(d.channel)} via {d.provider}
              </Typography>
              <Typography variant="caption">
                {humanizeCode(d.status)} · {d.attemptCount} attempts{' '}
                {d.failureCategory ? `· ${humanizeCode(d.failureCategory)}` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
    </Stack>
  );
}
