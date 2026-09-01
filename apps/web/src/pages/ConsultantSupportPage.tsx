import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StickyTabs } from '../components/common/StickyTabs';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';
type CaseStatus = 'OPEN' | 'WAITING_ON_SUPPORT' | 'WAITING_ON_CLIENT' | 'RESOLVED' | 'CLOSED';
type ConsultantCase = {
  id: string;
  subject: string;
  category: string;
  priority: Priority;
  status: CaseStatus;
  createdAt: string;
  lastMessageAt: string;
  updatedAt: string;
  unread?: boolean;
  context?: { type: string; resourceId: string | null; summary: string };
  attachments?: Array<{
    id: string;
    document: { id: string; displayFileName: string; mimeType: string; sizeBytes: number };
  }>;
  client: { id: string; firstName: string; lastName: string; user: { email: string } | null };
  messages: Array<{
    id: string;
    body: string;
    internal: boolean;
    createdAt: string;
    author: { id: string; role: 'CLIENT' | 'CONSULTANT' | 'ADMIN' };
  }>;
};

const statusLabels: Record<CaseStatus, string> = {
  OPEN: 'Open',
  WAITING_ON_SUPPORT: 'Needs response',
  WAITING_ON_CLIENT: 'Waiting on client',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const priorityColor: Record<Priority, 'info' | 'warning' | 'error'> = {
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};
const replyMacros = [
  [
    'REVIEWING',
    'Reviewing now',
    'Thanks for reaching out. I’m reviewing this now and will update you shortly.',
  ],
  [
    'NEED_DOCUMENT',
    'Request document',
    'Please upload the requested document so I can continue reviewing this for you.',
  ],
  [
    'NEED_CONFIRMATION',
    'Request confirmation',
    'Please confirm the requested detail so I can move this forward.',
  ],
  [
    'RESOLVED',
    'Resolution reply',
    'This has been addressed. Please let me know if you need anything else.',
  ],
] as const;

export function ConsultantSupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filter, setFilter] = useState<'ACTIVE' | 'URGENT' | 'WAITING_CLIENT' | 'RESOLVED'>(
    'ACTIVE',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerType, setComposerType] = useState<'REPLY' | 'INTERNAL'>('REPLY');
  const [draft, setDraft] = useState('');
  const [macroCode, setMacroCode] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [page, setPage] = useState(1);
  const filterStatus = filter === 'WAITING_CLIENT' ? 'WAITING_ON_CLIENT' : filter === 'RESOLVED' ? 'RESOLVED' : '';
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (caseSearch.trim()) params.set('search', caseSearch.trim());
  if (filterStatus) params.set('status', filterStatus);
  if (filter === 'URGENT') params.set('priority', 'URGENT');
  const query = useQuery({
    queryKey: ['consultant-support-cases', filter, caseSearch, page],
    queryFn: () => apiRequest<{ cases: ConsultantCase[]; hasMore: boolean; total: number }>(`/api/v1/consultant/support-cases?${params}`),
    placeholderData: keepPreviousData,
  });
  const allCases = query.data?.cases ?? [];
  const cases = allCases.filter((item) => {
    if (filter === 'URGENT')
      return item.priority === 'URGENT' && !['RESOLVED', 'CLOSED'].includes(item.status);
    if (filter === 'WAITING_CLIENT') return item.status === 'WAITING_ON_CLIENT';
    if (filter === 'RESOLVED') return ['RESOLVED', 'CLOSED'].includes(item.status);
    return !['RESOLVED', 'CLOSED'].includes(item.status);
  });
  const selected = allCases.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    const linkedCaseId = searchParams.get('case');
    if (linkedCaseId && allCases.some((item) => item.id === linkedCaseId))
      setSelectedId(linkedCaseId);
  }, [allCases, searchParams]);
  useEffect(() => {
    if (!isMobile && !selectedId && cases.length) setSelectedId(cases[0]!.id);
  }, [cases, isMobile, selectedId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['consultant-support-cases'] });
  const send = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/consultant/support-cases/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          message: draft,
          internal: composerType === 'INTERNAL',
          ...(macroCode ? { macroCode } : {}),
        }),
      }),
    onSuccess: async () => {
      setDraft('');
      setMacroCode(null);
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: (body: { status?: CaseStatus; priority?: Priority }) =>
      apiRequest(`/api/v1/consultant/support-cases/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...body, expectedUpdatedAt: selected?.updatedAt }),
      }),
    onSuccess: refresh,
  });

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load the support queue.</Alert>;

  return (
    <Stack spacing={0}>
      <Box sx={{ display: { xs: selected ? 'none' : 'block', md: 'block' }, mb: 3 }}>
        <PageHeader
          eyebrow="Client operations"
          title="Support"
          description="Prioritize requests, use prepared responses, and keep client-visible communication separate from internal notes."
        />
      </Box>
      <Grid container spacing={2}>
        <Grid
          size={{ xs: 12, md: 5, lg: 4 }}
          sx={{
            display: { xs: selected ? 'none' : 'block', md: 'block' },
            position: { md: 'sticky' },
            top: { md: 0 },
            alignSelf: { md: 'flex-start' },
            maxHeight: {
              md: 'calc(100dvh - 124px)',
              xl: 'calc(100dvh - 156px)',
            },
            overflowY: { md: 'auto' },
          }}
        >
          <SectionCard sx={{ p: { xs: 1.5, sm: 2.25 } }}>
            <StickyTabs sx={{ mb: 1 }}>
              <Tabs
                value={filter}
                onChange={(_, value) => {
                  setFilter(value);
                  setPage(1);
                  if (isMobile) setSelectedId(null);
                }}
                variant="scrollable"
              >
                <Tab
                  value="ACTIVE"
                  label={`Active (${allCases.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length})`}
                />
                <Tab
                  value="URGENT"
                  label={`Urgent (${allCases.filter((item) => item.priority === 'URGENT' && !['RESOLVED', 'CLOSED'].includes(item.status)).length})`}
                />
                <Tab value="WAITING_CLIENT" label="Waiting on client" />
                <Tab value="RESOLVED" label="Resolved" />
              </Tabs>
            </StickyTabs>
            <DataNavigationToolbar
              searchLabel="Search support queue"
              searchPlaceholder="Search client names and request subjects"
              searchValue={caseSearch}
              onSearchChange={(value) => { setCaseSearch(value); setPage(1); }}
              activeFilters={filter !== 'ACTIVE' ? [`View: ${filter.replace('_', ' ')}`] : []}
              resultLabel={`${query.data?.total ?? 0} requests`}
              loading={query.isFetching}
            />
            <Stack spacing={1}>
              {cases.length === 0 && (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <SupportAgentRounded color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    Queue clear
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No requests match this view.
                  </Typography>
                </Box>
              )}
              {cases.map((item) => (
                <Box
                  component="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  sx={{
                    border: '1px solid',
                    borderColor: selectedId === item.id ? 'primary.main' : 'divider',
                    bgcolor: selectedId === item.id ? 'action.selected' : 'transparent',
                    color: 'inherit',
                    borderRadius: 2.5,
                    p: 1.5,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 850 }} noWrap>
                        {item.subject}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {item.client.firstName} {item.client.lastName} · {statusLabels[item.status]}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={priorityColor[item.priority]}
                      label={
                        item.priority === 'URGENT'
                          ? 'Urgent'
                          : item.priority === 'HIGH'
                            ? 'High'
                            : 'Normal'
                      }
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
            <DataPagination page={page} pageSize={20} total={query.data?.total ?? 0} hasMore={Boolean(query.data?.hasMore)} onPageChange={setPage} loading={query.isFetching} />
          </SectionCard>
        </Grid>

        <Grid
          size={{ xs: 12, md: 7, lg: 8 }}
          sx={{
            display: { xs: selected ? 'block' : 'none', md: 'block' },
          }}
        >
          {selected ? (
            <SectionCard sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Stack spacing={2}>
                <Button
                  size="small"
                  startIcon={<ArrowBackRounded />}
                  onClick={() => setSelectedId(null)}
                  sx={{ display: { md: 'none' }, alignSelf: 'flex-start', px: 0.5 }}
                >
                  Back to queue
                </Button>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="overline" color="primary">
                      {selected.client.firstName} {selected.client.lastName}
                    </Typography>
                    <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
                      {selected.subject}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {selected.category.replaceAll('_', ' ')} · {selected.client.user?.email}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}
                  >
                    <Chip
                      color={priorityColor[selected.priority]}
                      label={`${selected.priority === 'URGENT' ? 'Urgent' : selected.priority === 'HIGH' ? 'High' : 'Normal'} priority`}
                    />
                    <Chip variant="outlined" label={statusLabels[selected.status]} />
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={selected.priority}
                    onChange={(_, priority: Priority | null) =>
                      priority && update.mutate({ priority })
                    }
                  >
                    <ToggleButton value="NORMAL">Normal</ToggleButton>
                    <ToggleButton value="HIGH">High</ToggleButton>
                    <ToggleButton value="URGENT">Urgent</ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    variant="outlined"
                    startIcon={<CheckCircleRounded />}
                    onClick={() => update.mutate({ status: 'RESOLVED' })}
                  >
                    Resolve
                  </Button>
                </Stack>
                {selected.context && selected.context.type !== 'GENERAL' && (
                  <Alert severity="info">Validated context: {selected.context.summary}</Alert>
                )}
                {!!selected.attachments?.length && (
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {selected.attachments.map(({ document }) => (
                      <Button
                        key={document.id}
                        size="small"
                        variant="outlined"
                        href={`/api/v1/documents/${document.id}/content`}
                      >
                        {document.displayFileName}
                      </Button>
                    ))}
                  </Stack>
                )}
                <Divider />

                <Stack
                  spacing={1.5}
                  sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: 'rgba(7,11,24,.34)', borderRadius: 3 }}
                >
                  {selected.messages.map((message) => {
                    const mine = message.author.id === user?.userId;
                    return (
                      <Box
                        key={message.id}
                        sx={{
                          alignSelf: message.internal
                            ? 'stretch'
                            : mine
                              ? 'flex-end'
                              : 'flex-start',
                          maxWidth: message.internal ? '100%' : '88%',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {message.internal
                            ? 'Internal note'
                            : message.author.role === 'CLIENT'
                              ? selected.client.firstName
                              : 'You'}{' '}
                          · {new Date(message.createdAt).toLocaleString()}
                        </Typography>
                        <Box
                          sx={{
                            mt: 0.4,
                            px: 1.75,
                            py: 1.25,
                            borderRadius: 2.5,
                            border: message.internal ? '1px dashed' : 0,
                            borderColor: 'warning.main',
                            bgcolor: message.internal
                              ? 'rgba(246,184,75,.10)'
                              : mine
                                ? 'primary.main'
                                : 'action.hover',
                            color: message.internal
                              ? 'text.primary'
                              : mine
                                ? 'primary.contrastText'
                                : 'text.primary',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {message.body}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>

                {!['RESOLVED', 'CLOSED'].includes(selected.status) && (
                  <Stack spacing={1.5}>
                    <Typography sx={{ fontWeight: 850 }}>Prepared responses</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {replyMacros.map(([code, label, text]) => (
                        <Button
                          key={code}
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setDraft(text);
                            setMacroCode(code);
                            setComposerType('REPLY');
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </Stack>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth={isMobile}
                      size="small"
                      value={composerType}
                      onChange={(_, value: 'REPLY' | 'INTERNAL' | null) =>
                        value && setComposerType(value)
                      }
                    >
                      <ToggleButton value="REPLY">Client reply</ToggleButton>
                      <ToggleButton value="INTERNAL">
                        <LockRounded fontSize="small" sx={{ mr: 0.75 }} />
                        Internal note
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <TextField
                      label={composerType === 'INTERNAL' ? 'Internal note' : 'Reply to client'}
                      multiline
                      minRows={4}
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        setMacroCode(null);
                      }}
                    />
                    {send.isError && <Alert severity="error">{send.error.message}</Alert>}
                    <Button
                      variant="contained"
                      startIcon={composerType === 'INTERNAL' ? <LockRounded /> : <SendRounded />}
                      disabled={!draft.trim() || send.isPending}
                      onClick={() => send.mutate()}
                      sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' } }}
                    >
                      {send.isPending
                        ? 'Saving…'
                        : composerType === 'INTERNAL'
                          ? 'Save internal note'
                          : 'Send reply'}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </SectionCard>
          ) : (
            <SectionCard sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'center', py: 8 }}>
              <SupportAgentRounded color="primary" sx={{ fontSize: 48 }} />
              <Typography variant="h3" sx={{ mt: 1 }}>
                Select a request
              </Typography>
            </SectionCard>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}
