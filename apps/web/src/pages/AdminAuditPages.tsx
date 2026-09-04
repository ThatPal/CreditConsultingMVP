import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type EventRow = {
  id: string;
  createdAt: string;
  actorId: string | null;
  clientId: string | null;
  entityType: string | null;
  entityId: string | null;
  actor: { name: string | null; email: string } | null;
  action?: string;
  eventType?: string;
  severity?: string;
  category?: string;
};
type EventDetail = EventRow & {
  source?: string;
  requestId?: string | null;
  correlationId?: string | null;
  metadata: unknown;
};

export function AdminEventListPage({ kind }: { kind: 'audit' | 'security' }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const action = params.get('action') ?? '';
  const severity = params.get('severity') ?? '';
  const endpoint = kind === 'audit' ? 'audit-events' : 'security-events';
  const query = useInfiniteQuery({
    queryKey: ['admin-events', kind, search, action, severity],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      apiRequest<{ events: EventRow[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/v1/admin/${endpoint}?limit=50&search=${encodeURIComponent(search)}${action ? `&action=${encodeURIComponent(action)}` : ''}${severity ? `&severity=${severity}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((page) => page.events) ?? [];
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        title={kind === 'audit' ? 'Audit history' : 'Security events'}
        description={
          kind === 'audit'
            ? 'Immutable operational change history with safe entity cross-links.'
            : 'Authentication, authorization, session, and security-significant history.'
        }
      />
      <DataNavigationToolbar
        searchLabel={`Search ${kind} events`}
        searchPlaceholder="Action, category, or entity"
        searchValue={search}
        onSearchChange={(value) => set('search', value)}
        resultLabel={`${rows.length}${query.hasNextPage ? '+' : ''} events loaded`}
      >
        <TextField
          size="small"
          label={kind === 'audit' ? 'Action' : 'Event type'}
          value={action}
          onChange={(event) => set('action', event.target.value)}
        />
        {kind === 'security' && (
          <TextField
            select
            size="small"
            label="Severity"
            value={severity}
            onChange={(event) => set('severity', event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="INFO">Info</MenuItem>
            <MenuItem value="WARNING">Warning</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
          </TextField>
        )}
      </DataNavigationToolbar>
      {query.isError && <Alert severity="error">Event history could not be loaded.</Alert>}
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {rows.map((event) => (
            <Stack key={event.id} sx={{ py: 2, gap: 1 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ justifyContent: 'space-between', gap: 1 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {event.action ?? event.eventType}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(event.createdAt).toLocaleString()} ·{' '}
                    {event.actor?.name || event.actor?.email || 'System'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {event.severity && <Chip size="small" label={event.severity} />}
                  <Button component={Link} to={`/admin/${endpoint}/${event.id}`}>
                    Details
                  </Button>
                </Stack>
              </Stack>
              {event.entityType && (
                <Typography variant="caption">
                  {event.entityType} {event.entityId ?? ''}
                </Typography>
              )}
            </Stack>
          ))}
          {!query.isLoading && !rows.length && (
            <Typography color="text.secondary">No matching events.</Typography>
          )}
        </Stack>
      </SectionCard>
      {query.hasNextPage && (
        <Button
          variant="outlined"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Load older events
        </Button>
      )}
    </Stack>
  );
}

const entityLink = (event: EventDetail) => {
  if (event.clientId) return `/crm/clients/${event.clientId}`;
  if (event.entityType === 'User' && event.entityId) return `/admin/users/${event.entityId}`;
  if (event.entityType?.includes('Payment') && event.entityId)
    return `/admin/payments/${event.entityId}`;
  return null;
};
export function AdminEventDetailPage({ kind }: { kind: 'audit' | 'security' }) {
  const { eventId = '' } = useParams();
  const endpoint = kind === 'audit' ? 'audit-events' : 'security-events';
  const query = useQuery({
    queryKey: ['admin-event', kind, eventId],
    queryFn: () => apiRequest<{ event: EventDetail }>(`/api/v1/admin/${endpoint}/${eventId}`),
  });
  const event = query.data?.event;
  if (query.isLoading) return <Typography>Loading event…</Typography>;
  if (!event) return <Alert severity="error">Event could not be loaded.</Alert>;
  const link = entityLink(event);
  return (
    <Stack spacing={3}>
      <PageHeader
        title={event.action ?? event.eventType ?? 'Event detail'}
        description={`${new Date(event.createdAt).toLocaleString()} · immutable record`}
        actions={
          <Button component={Link} to={`/admin/${endpoint}`}>
            Back to history
          </Button>
        }
      />
      <SectionCard>
        <Stack spacing={1}>
          <Typography>Actor: {event.actor?.name || event.actor?.email || 'System'}</Typography>
          <Typography>
            Entity: {event.entityType ?? 'None'} {event.entityId ?? ''}
          </Typography>
          <Typography>Client: {event.clientId ?? 'Platform scope'}</Typography>
          {event.severity && <Chip label={event.severity} sx={{ alignSelf: 'flex-start' }} />}
          {link && (
            <Button component={Link} to={link} sx={{ alignSelf: 'flex-start' }}>
              Open related record
            </Button>
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Safe metadata</Typography>
        <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', m: 0, mt: 2 }}>
          {JSON.stringify(event.metadata ?? {}, null, 2)}
        </Box>
      </SectionCard>
    </Stack>
  );
}
