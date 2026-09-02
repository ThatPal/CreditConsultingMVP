import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRounded from '@mui/icons-material/AssignmentTurnedInRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  CircularProgress,
  MenuItem,
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { ChoiceCard } from '../components/common/ChoiceCard';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { humanizeCode, priorityLabel } from '../components/common/labels';

const demoNotice = (
  <Alert severity="info">
    Preview data is illustrative and is not part of an authoritative client record.
  </Alert>
);

export function ConsultantDashboardPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Consultant operations"
        title="Consultant workspace"
        description="Open prioritized work, client reviews, and support from one secure workspace."
      />
      <Alert severity="info">
        Only authoritative operational modules are shown. Illustrative metrics are intentionally
        excluded.
      </Alert>
      <Grid container spacing={2}>
        {[
          {
            title: 'Work queue',
            description: 'Review prioritized, API-backed attention items and claim available work.',
            path: '/crm/work-queue',
          },
          {
            title: 'Client reviews',
            description: 'Continue accepted review work without fabricated client summaries.',
            path: '/crm/reviews',
          },
          {
            title: 'Support',
            description: 'Respond to authorized client support cases.',
            path: '/crm/support',
          },
        ].map(({ title, description, path }) => (
          <Grid key={title} size={{ xs: 12, md: 4 }}>
            <SectionCard variant="interactive">
              <Stack spacing={1.5}>
                <Typography variant="h3">{title}</Typography>
                <Typography color="text.secondary">{description}</Typography>
                <Button
                  component={Link}
                  to={path}
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Open
                </Button>
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export function WorkQueuePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const assignment = searchParams.get('assignment') ?? 'ALL';
  const priority = searchParams.get('priority') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const updateQueueState = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value && value !== 'ALL' ? next.set(key, value) : next.delete(key),
    );
    setSearchParams(next);
  };
  type QueueItem = {
    id: string;
    title: string;
    priority: string;
    status: string;
    dueAt: string | null;
    neededSince: string | null;
    version: number;
    assigneeId: string | null;
    reasonCode: string | null;
    deepLink: { route?: string; params?: { caseId?: string } } | null;
    client: { firstName: string; lastName: string };
    assignee: { name: string | null; email: string } | null;
  };
  type QueueResponse = {
    items: QueueItem[];
    total: number;
    pageSize: number;
    counts: { open: number; urgent: number; mine: number; unassigned: number };
  };
  const params = new URLSearchParams({
    assignment,
    page: String(page),
    pageSize: '12',
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  });
  const queue = useQuery({
    queryKey: ['work-queue', assignment, priority, status, search, page],
    queryFn: () => apiRequest<QueueResponse>(`/consultant/work-queue?${params}`),
    placeholderData: (previous) => previous,
  });
  const claim = useMutation({
    mutationFn: (item: QueueItem) =>
      apiRequest(`/consultant/work-queue/${item.id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: item.version }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-queue'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Operations"
        title="Work queue"
        description="Prioritized work with the next safe action already prepared."
        actions={
          queue.data?.items[0] ? (
            <Button
              component={Link}
              to={
                queue.data.items[0].deepLink?.route
                  ? `${queue.data.items[0].deepLink.route}?case=${queue.data.items[0].deepLink.params?.caseId ?? ''}`
                  : '/crm/work-queue'
              }
              variant="contained"
            >
              Start highest priority
            </Button>
          ) : undefined
        }
      />
      <SectionCard variant="operational">
        <Stack spacing={2}>
          <DataNavigationToolbar
            searchLabel="Search work"
            searchPlaceholder="Search client, reason, or next action"
            searchValue={search}
            onSearchChange={(value) => {
              updateQueueState({ search: value, page: '1' });
            }}
            activeFilters={[
              ...(assignment !== 'ALL' ? [`Assignment: ${humanizeCode(assignment)}`] : []),
              ...(priority ? [`Priority: ${priorityLabel(priority)}`] : []),
              ...(status ? [`Lifecycle: ${humanizeCode(status)}`] : []),
            ]}
            onClearFilters={() => {
              setSearchParams({ page: '1' });
            }}
            resultLabel={`${queue.data?.total ?? 0} attention items`}
            loading={queue.isFetching}
          >
            <TextField
              select
              label="Assignment"
              value={assignment}
              onChange={(e) => {
                updateQueueState({ assignment: e.target.value, page: '1' });
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="ALL">All accessible</MenuItem>
              <MenuItem value="MINE">My work</MenuItem>
              <MenuItem value="UNASSIGNED">Unassigned</MenuItem>
            </TextField>
            <TextField
              select
              label="Priority"
              value={priority}
              onChange={(e) => {
                updateQueueState({ priority: e.target.value, page: '1' });
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All priorities</MenuItem>
              {['URGENT', 'HIGH', 'NORMAL', 'LOW'].map((v) => (
                <MenuItem key={v} value={v}>
                  {priorityLabel(v)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Lifecycle"
              value={status}
              onChange={(e) => {
                updateQueueState({ status: e.target.value, page: '1' });
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">Active</MenuItem>
              {['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED'].map((v) => (
                <MenuItem key={v} value={v}>
                  {humanizeCode(v)}
                </MenuItem>
              ))}
            </TextField>
          </DataNavigationToolbar>
          {queue.data && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`${queue.data.counts.open} active`} />
              <Chip color="error" label={`${queue.data.counts.urgent} urgent`} />
              <Chip label={`${queue.data.counts.mine} mine`} />
              <Chip label={`${queue.data.counts.unassigned} unassigned`} />
            </Stack>
          )}
          {queue.isLoading && (
            <Stack sx={{ alignItems: 'center', py: 5 }}>
              <CircularProgress aria-label="Loading work queue" />
            </Stack>
          )}
          {queue.isError && (
            <Alert severity="error" action={<Button onClick={() => queue.refetch()}>Retry</Button>}>
              The work queue could not be loaded.
            </Alert>
          )}
          {claim.isError && (
            <Alert severity="warning">
              This item changed or access was revoked. Refresh the queue before continuing.
            </Alert>
          )}
          {queue.data?.items.length === 0 && (
            <Alert severity="info">No attention items match these filters.</Alert>
          )}
          <Stack divider={<Divider />}>
            {queue.data?.items.map((item) => {
              const href = item.deepLink?.route
                ? `${item.deepLink.route}?case=${item.deepLink.params?.caseId ?? ''}`
                : '/crm/work-queue';
              return (
                <Stack
                  key={item.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'center' }, py: 2 }}
                >
                  <Stack sx={{ flex: 1 }} spacing={0.5}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Chip
                        size="small"
                        color={
                          item.priority === 'URGENT'
                            ? 'error'
                            : item.priority === 'HIGH'
                              ? 'warning'
                              : 'default'
                        }
                        label={priorityLabel(item.priority)}
                      />
                      <Typography variant="h3">{item.title}</Typography>
                    </Stack>
                    <Typography color="text.secondary">
                      {item.client.firstName} {item.client.lastName} ·{' '}
                      {humanizeCode(item.reasonCode)}
                    </Typography>
                    <Typography variant="caption">
                      Needed{' '}
                      {item.neededSince ? new Date(item.neededSince).toLocaleString() : 'recently'}{' '}
                      ·{' '}
                      {item.assignee
                        ? `Claimed by ${item.assignee.name ?? item.assignee.email}`
                        : 'Unassigned'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {!item.assigneeId && (
                      <Button
                        variant="outlined"
                        disabled={claim.isPending}
                        onClick={() => claim.mutate(item)}
                      >
                        Claim
                      </Button>
                    )}
                    <Button component={Link} to={href} variant="contained">
                      Open workspace
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
          {queue.data && (
            <DataPagination
              page={page}
              pageSize={queue.data.pageSize}
              total={queue.data.total}
              hasMore={page * queue.data.pageSize < queue.data.total}
              onPageChange={(nextPage) => updateQueueState({ page: String(nextPage) })}
              loading={queue.isFetching}
            />
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function ClientsPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Relationships"
        title="Clients"
        description="Client directory and Client 360 workflows are reserved for their owning product phase."
      />
      <SectionCard>
        <Stack spacing={2}>
          <Chip label="Future owner" color="info" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="h3">
            A trustworthy directory starts with governed client records
          </Typography>
          <Typography color="text.secondary">
            No example people or financial figures are shown here. Until the accepted directory is
            available, use the Work Queue, Reviews, and Support areas for authorized client work.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={Link} to="/crm/work-queue" variant="contained">
              Open work queue
            </Button>
            <Button component={Link} to="/crm/reviews" variant="outlined">
              Open reviews
            </Button>
            <Button component={Link} to="/crm/support" variant="outlined">
              Open support
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function ClientOverviewPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your strategy"
        title="Welcome back"
        description="Your secure starting point for the Phase 1–3 tools currently available."
      />
      <Alert severity="info">
        Personalized progress, financial totals, and next-best-action projections will appear only
        when their owning product workflow supplies verified data.
      </Alert>
      <Grid container spacing={2}>
        {[
          {
            title: 'Credit Center',
            description: 'Review your accepted credit-profile and review workflows.',
            path: '/app/credit-center',
          },
          {
            title: 'Documents',
            description: 'Upload, find, and securely view your files.',
            path: '/app/documents',
          },
          {
            title: 'Support',
            description: 'Ask for help and follow your existing cases.',
            path: '/app/support',
          },
        ].map(({ title, description, path }) => (
          <Grid key={title} size={{ xs: 12, md: 4 }}>
            <SectionCard variant="interactive">
              <Stack spacing={1.5}>
                <Typography variant="h3">{title}</Typography>
                <Typography color="text.secondary">{description}</Typography>
                <Button
                  component={Link}
                  to={path}
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Open
                </Button>
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export function CreditPlanPage() {
  const query = useQuery({
    queryKey: ['credit-plan'],
    queryFn: () =>
      apiRequest<{
        actions: Array<{
          id: string;
          title: string;
          description: string | null;
          status: string;
          dueAt: string | null;
        }>;
      }>('/api/v1/client/credit-plan'),
    retry: false,
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError) return <Alert severity="error">Unable to load your Credit Plan.</Alert>;
  const actions = query.data!.actions;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Coordinated strategy"
        title="Credit Plan"
        description="Every recommendation, dependency, and milestone in the order it should happen."
      />
      {actions.length === 0 && (
        <SectionCard>
          <Typography variant="h3">No plan actions yet</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Your consultant will publish coordinated actions here after a completed Review or
            service assessment.
          </Typography>
        </SectionCard>
      )}
      {actions.map((action, i) => (
        <SectionCard key={action.id} variant={i === 0 ? 'elevated' : 'standard'}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: i === 0 ? 'primary.main' : 'action.selected',
                color: i === 0 ? 'background.default' : 'text.primary',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4">{action.title}</Typography>
              <Typography color="text.secondary">
                {action.description ??
                  (action.dueAt
                    ? `Due ${new Date(action.dueAt).toLocaleDateString()}`
                    : 'Timing coordinated by your consultant')}
              </Typography>
            </Box>
            <Chip
              label={action.status.replaceAll('_', ' ')}
              color={i === 0 ? 'primary' : 'default'}
            />
          </Stack>
        </SectionCard>
      ))}
    </Stack>
  );
}

export function CreditProfilePage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Verified financial facts"
        title="Credit Profile"
        description="A current, historical view of the facts your strategy is based on."
        actions={<Button variant="contained">Update profile</Button>}
      />
      {demoNotice}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            label="Profile status"
            value="Current"
            supportingText="Updated 12 days ago"
            accent="positive"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            label="Utilization"
            value="28%"
            supportingText="Target band: under 10%"
            accent="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            label="Open accounts"
            value="9"
            supportingText="4 revolving · 5 installment"
            accent="info"
          />
        </Grid>
      </Grid>
      <SectionCard>
        <Typography variant="h3">Consultant findings</Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
          <Chip label="Utilization needs preparation" color="warning" />
          <Chip label="Payment history strong" color="success" />
          <Chip label="Recent inquiry activity" />
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function ReadinessPage({ consultant = false }: { consultant?: boolean }) {
  const [outcome, setOutcome] = useState('PREPARE');
  const [reasons, setReasons] = useState<string[]>(['UTILIZATION', 'DOCUMENTS']);
  const profileQuery = useQuery({
    queryKey: ['credit-profile'],
    queryFn: () =>
      apiRequest<{
        profile: {
          generalReadiness: string;
          freshness: { asOf: string | null; expiresAt: string | null; isCurrent: boolean };
          review: {
            clientSummary: string | null;
            findings: Array<{ id: string; label: string; severity: string }>;
          } | null;
          actions: Array<{
            id: string;
            title: string;
            description: string | null;
            status: string;
            dueAt: string | null;
          }>;
        };
      }>('/api/v1/client/credit-profile'),
    enabled: !consultant,
    retry: false,
  });
  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () =>
      apiRequest<{
        goals: Array<{
          goalType: string;
          targetAmount: number | null;
          priority: string;
          status: string;
        }>;
      }>('/api/v1/client/goals'),
    enabled: !consultant,
  });
  const cyclesQuery = useQuery({
    queryKey: ['application-cycles'],
    queryFn: () =>
      apiRequest<{
        cycles: Array<{ id: string; cycleNumber: number; status: string; currentStage: string }>;
      }>('/api/v1/client/application-cycles'),
    enabled: !consultant,
  });
  const choices = [
    {
      id: 'APPLY',
      title: 'Ready',
      desc: 'The current profile supports beginning a credit application round.',
    },
    {
      id: 'PREPARE',
      title: 'Prepare — action needed',
      desc: 'Complete the consultant-selected actions, then reassess.',
    },
    {
      id: 'WAIT',
      title: 'Not ready — negative items',
      desc: 'Negative credit items should be resolved or allowed to improve before applying.',
    },
  ];
  const profile = profileQuery.data?.profile;
  const readinessFreshness =
    import.meta.env.DEV && !profile?.review
      ? { isCurrent: true, expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() }
      : profile?.freshness;
  const clientOutcome =
    profile?.generalReadiness === 'HIGH'
      ? 'APPLY'
      : profile?.generalReadiness === 'LOW' || profile?.generalReadiness === 'EXPIRED'
        ? 'WAIT'
        : 'PREPARE';
  const selectedOutcome = consultant ? outcome : clientOutcome;
  const consultantDecisionReady = clientOutcome === 'APPLY';
  const consultantDecisionHeading = consultantDecisionReady
    ? 'Ready'
    : clientOutcome === 'WAIT'
      ? 'Not ready'
      : 'Prepare';
  const consultantDecisionColor = consultantDecisionReady
    ? '#42e6a4'
    : clientOutcome === 'WAIT'
      ? '#ff647c'
      : '#ffb34d';
  const consultantDecisionDetail = consultantDecisionReady
    ? 'Ready for a credit application round'
    : clientOutcome === 'WAIT'
      ? 'Negative credit items should be addressed before beginning a credit application round'
      : 'Complete the preparation actions before beginning a credit application round';
  const primaryGoal =
    goalsQuery.data?.goals.find(
      (goal) => goal.priority === 'PRIMARY' && goal.status === 'ACTIVE',
    ) ?? goalsQuery.data?.goals.find((goal) => goal.status === 'ACTIVE');
  const goalNames: Record<string, string> = {
    ZERO_APR_CREDIT: 'Build 0% APR credit',
    TOTAL_AVAILABLE_CREDIT: 'Increase total available credit',
    BUSINESS_CREDIT: 'Build business credit',
    PERSONAL_CREDIT: 'Build personal credit',
    BALANCE_TRANSFER_CAPACITY: 'Create balance-transfer capacity',
    EXISTING_LIMIT_INCREASES: 'Increase existing limits',
    REWARDS_POINTS_PORTFOLIO: 'Build a rewards portfolio',
  };
  const connectedCycle =
    cyclesQuery.data?.cycles.find((cycle) => cycle.status === 'ACTIVE') ??
    cyclesQuery.data?.cycles[0];
  const readinessFindings = profile?.review?.findings.length
    ? profile.review.findings
    : import.meta.env.DEV
      ? [
          { id: 'demo-readiness-1', label: 'Strong payment history', severity: 'POSITIVE' },
          { id: 'demo-readiness-2', label: 'Utilization needs preparation', severity: 'CAUTION' },
          { id: 'demo-readiness-3', label: 'Recent inquiry activity', severity: 'CAUTION' },
        ]
      : [];
  const actions = profile?.actions.length
    ? profile.actions
    : import.meta.env.DEV
      ? [
          {
            id: 'demo-action-1',
            title: 'Pay down revolving balances',
            description: 'Target aggregate utilization below 30%.',
            status: 'READY',
            dueAt: null,
          },
          {
            id: 'demo-action-2',
            title: 'Allow inquiries to age',
            description: 'Avoid new applications for 90 days.',
            status: 'READY',
            dueAt: null,
          },
        ]
      : [];
  const nextAction = actions.find((action) => !['COMPLETED', 'CANCELLED'].includes(action.status));
  const actionCounts = {
    completed: actions.filter((action) => action.status === 'COMPLETED').length,
    active: actions.filter((action) => ['READY', 'IN_PROGRESS', 'ACTIVE'].includes(action.status))
      .length,
    paused: actions.filter((action) => ['PAUSED', 'DEFERRED'].includes(action.status)).length,
    blocked: actions.filter((action) => action.status === 'BLOCKED').length,
  };
  const toggleReason = (id: string) =>
    setReasons((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]));
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={consultant ? 'Guided decision workspace' : 'Credit application strategy'}
        title="Credit Readiness"
        description={
          consultant
            ? 'Confirm a structured outcome using verified facts and prepared action bundles.'
            : 'Know whether to apply now, prepare first, or wait—and exactly what comes next.'
        }
        actions={consultant ? <Button variant="contained">Confirm assessment</Button> : undefined}
      />
      {consultant && demoNotice}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <SectionCard
            variant="elevated"
            sx={
              !consultant
                ? {
                    borderColor: `${consultantDecisionColor}70`,
                    background: `linear-gradient(135deg, ${consultantDecisionColor}1f 0%, rgba(16, 35, 66, .98) 58%, rgba(12, 25, 49, .98) 100%)`,
                    boxShadow: `0 18px 46px rgba(0, 0, 0, .24), 0 0 28px ${consultantDecisionColor}14`,
                  }
                : {}
            }
          >
            {!consultant && (
              <>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'center' } }}
                >
                  <Box
                    sx={{
                      width: 54,
                      height: 54,
                      flex: '0 0 auto',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 2.5,
                      color: consultantDecisionColor,
                      bgcolor: `${consultantDecisionColor}14`,
                      border: `1px solid ${consultantDecisionColor}55`,
                      boxShadow: `0 0 22px ${consultantDecisionColor}20`,
                      '& svg': { fontSize: 32 },
                    }}
                  >
                    {consultantDecisionReady ? (
                      <CheckCircleRounded />
                    ) : clientOutcome === 'WAIT' ? (
                      <ErrorOutlineRounded />
                    ) : (
                      <ShieldRounded />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="overline" sx={{ color: consultantDecisionColor }}>
                      Consultant decision
                    </Typography>
                    <Typography variant="h2" sx={{ mt: 0.25 }}>
                      {consultantDecisionHeading}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {consultantDecisionDetail}
                    </Typography>
                  </Box>
                  <Chip
                    label={
                      consultantDecisionReady
                        ? 'READY'
                        : clientOutcome === 'WAIT'
                          ? 'NEGATIVE ITEMS'
                          : 'ACTION NEEDED'
                    }
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      color: consultantDecisionColor,
                      bgcolor: `${consultantDecisionColor}12`,
                      border: `1px solid ${consultantDecisionColor}55`,
                      fontWeight: 900,
                    }}
                  />
                </Stack>
                <Divider sx={{ my: 2.5 }} />
              </>
            )}
            {consultant ? (
              <>
                <Typography variant="overline" color="primary">
                  Select outcome
                </Typography>
                <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                  {choices.map((c) => (
                    <Grid key={c.id} size={{ xs: 12, md: 4 }}>
                      <ChoiceCard
                        title={c.title}
                        description={c.desc}
                        selected={selectedOutcome === c.id}
                        onClick={() => setOutcome(c.id)}
                        icon={
                          c.id === 'APPLY' ? (
                            <CheckCircleRounded />
                          ) : c.id === 'WAIT' ? (
                            <ErrorOutlineRounded />
                          ) : (
                            <ShieldRounded />
                          )
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            ) : (
              <Box role="img" aria-label={`Readiness meter: ${consultantDecisionHeading} selected`}>
                <Typography variant="overline" color="primary">
                  Readiness scale
                </Typography>
                <Box sx={{ position: 'relative', mt: 2.25, px: { xs: 0.5, sm: 2 } }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 17,
                      left: { xs: '16.7%', sm: '18%' },
                      right: { xs: '16.7%', sm: '18%' },
                      height: 6,
                      borderRadius: 99,
                      background: 'linear-gradient(90deg, #ff647c 0%, #ffb34d 50%, #42e6a4 100%)',
                      boxShadow: '0 0 18px rgba(69, 215, 240, .14)',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                    }}
                  >
                    {(
                      [
                        { id: 'WAIT', label: 'Not Ready', detail: 'Wait', color: '#ff647c' },
                        {
                          id: 'PREPARE',
                          label: 'Prepare',
                          detail: 'Action needed',
                          color: '#ffb34d',
                        },
                        { id: 'APPLY', label: 'Ready', detail: 'Proceed', color: '#42e6a4' },
                      ] as const
                    ).map((point) => {
                      const active = selectedOutcome === point.id;
                      return (
                        <Stack
                          key={point.id}
                          sx={{ alignItems: 'center', textAlign: 'center', minWidth: 0 }}
                        >
                          <Box
                            sx={{
                              width: active ? 40 : 28,
                              height: active ? 40 : 28,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              zIndex: 1,
                              color: active ? '#07111f' : point.color,
                              bgcolor: active ? point.color : 'background.paper',
                              border: `3px solid ${point.color}`,
                              boxShadow: active
                                ? `0 0 0 6px ${point.color}22, 0 0 24px ${point.color}80`
                                : 'none',
                              transition: 'all 180ms ease',
                            }}
                          >
                            {active && <CheckCircleRounded sx={{ fontSize: 23 }} />}
                          </Box>
                          <Typography
                            sx={{
                              mt: 1.25,
                              fontWeight: active ? 950 : 800,
                              color: active ? point.color : 'text.primary',
                            }}
                          >
                            {point.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {point.detail}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard>
            <Typography variant="h4">Profile prerequisite</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
              {readinessFreshness?.isCurrent ? (
                <CheckCircleRounded color="success" />
              ) : (
                <ErrorOutlineRounded color="warning" />
              )}
              <Typography>
                {readinessFreshness?.isCurrent
                  ? 'Credit Profile current'
                  : 'Credit Profile update required'}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {readinessFreshness?.expiresAt
                ? `Current through ${new Date(readinessFreshness.expiresAt).toLocaleDateString()}.`
                : 'Complete a Credit Profile Review before advancing.'}
            </Typography>
            <Button component={Link} to="/client/credit-profile" variant="text" sx={{ mt: 1 }}>
              View Credit Profile
            </Button>
          </SectionCard>
        </Grid>
      </Grid>
      {consultant ? (
        <SectionCard variant="operational">
          <Typography variant="h3">Select supporting factors</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Prepared factors reduce repetitive typing. Add a note only for an exception.
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ChoiceCard
                title="Reduce utilization"
                description="Bring aggregate revolving utilization below the selected threshold."
                selected={reasons.includes('UTILIZATION')}
                onClick={() => toggleReason('UTILIZATION')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ChoiceCard
                title="Complete documents"
                description="Upload income and identity verification."
                selected={reasons.includes('DOCUMENTS')}
                onClick={() => toggleReason('DOCUMENTS')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ChoiceCard
                title="Allow inquiries to age"
                description="Use a prepared 30, 60, or 90-day timing band."
                selected={reasons.includes('INQUIRIES')}
                onClick={() => toggleReason('INQUIRIES')}
              />
            </Grid>
          </Grid>
        </SectionCard>
      ) : (
        <>
          <SectionCard variant="elevated">
            <Typography variant="overline" color="primary">
              Decision factors
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              Why this decision
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 750 }}>
              {selectedOutcome === 'APPLY'
                ? 'Your current Credit Profile supports moving forward.'
                : selectedOutcome === 'PREPARE'
                  ? 'Complete the selected preparation actions before applying.'
                  : 'Wait before applying while the selected credit factors are addressed.'}
            </Typography>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Selected factors
            </Typography>
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
              {readinessFindings.length ? (
                readinessFindings.map((finding) => (
                  <Chip
                    key={finding.id}
                    size="small"
                    label={finding.label}
                    color={
                      finding.severity === 'POSITIVE'
                        ? 'success'
                        : finding.severity === 'CRITICAL'
                          ? 'error'
                          : 'warning'
                    }
                  />
                ))
              ) : (
                <Typography color="text.secondary">
                  No rationale selections have been published.
                </Typography>
              )}
            </Stack>
          </SectionCard>
          <SectionCard variant="operational">
            <Typography variant="h3">Action plan</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Complete these consultant-selected actions before the next readiness decision.
            </Typography>
            {actions.length ? (
              <Stack spacing={1}>
                {actions.map((action) => (
                  <Stack
                    key={action.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      gap: 1,
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <CheckCircleRounded
                      color={action.status === 'COMPLETED' ? 'success' : 'disabled'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 850 }}>{action.title}</Typography>
                      {action.description && (
                        <Typography variant="body2" color="text.secondary">
                          {action.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="small" label={action.status.replaceAll('_', ' ')} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No readiness actions have been assigned.
              </Typography>
            )}
          </SectionCard>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <SectionCard>
                <Typography variant="h3">Action progress</Typography>
                <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
                  <Chip
                    label={`${actionCounts.completed} completed`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip label={`${actionCounts.active} active`} color="info" variant="outlined" />
                  <Chip label={`${actionCounts.paused} paused`} variant="outlined" />
                  <Chip
                    label={`${actionCounts.blocked} blocked`}
                    color="error"
                    variant="outlined"
                  />
                </Stack>
                <Box
                  sx={{
                    mt: 2,
                    p: 1.75,
                    borderRadius: 2,
                    bgcolor: 'rgba(69, 215, 240, .07)',
                    border: '1px solid rgba(69, 215, 240, .2)',
                  }}
                >
                  <Typography variant="overline" color="text.secondary">
                    Next milestone
                  </Typography>
                  <Typography sx={{ fontWeight: 900, mt: 0.35 }}>
                    {nextAction?.title ?? 'No next action assigned'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {nextAction
                      ? `${nextAction.description ?? 'Complete the next assigned action.'}${nextAction.dueAt ? ` · Due ${new Date(nextAction.dueAt).toLocaleDateString()}` : ''}`
                      : 'Your consultant has not assigned another milestone.'}
                  </Typography>
                </Box>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard>
                <Typography variant="h3">Goal and application cycle</Typography>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1.5 }}
                >
                  Primary goal
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {primaryGoal
                    ? (goalNames[primaryGoal.goalType] ?? primaryGoal.goalType)
                    : 'No primary goal selected'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedOutcome === 'APPLY'
                    ? 'The current recommendation supports advancing this goal.'
                    : selectedOutcome === 'PREPARE'
                      ? 'Preparation actions should be completed before advancing this goal.'
                      : 'Application activity should wait while the profile is strengthened.'}
                </Typography>
                <Divider sx={{ my: 2 }} />
                {connectedCycle ? (
                  <>
                    <Typography sx={{ fontWeight: 900 }}>
                      Cycle {connectedCycle.cycleNumber}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                      Current stage:{' '}
                      {connectedCycle.currentStage.replaceAll('_', ' ').toLowerCase()}
                    </Typography>
                  </>
                ) : (
                  <Typography color="text.secondary">
                    No application cycle is currently connected.
                  </Typography>
                )}
                <Button
                  component={Link}
                  to="/client/application-rounds"
                  variant="outlined"
                  sx={{ mt: 1.5 }}
                >
                  View Credit Applications
                </Button>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}

export function SimpleDomainPage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Connected workspace"
        title={title}
        description={description}
        actions={<Button variant="contained">{action}</Button>}
      />
      {demoNotice}
      <SectionCard variant="elevated">
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <AssignmentTurnedInRounded color="primary" sx={{ fontSize: 42 }} />
          <Typography variant="h3">Workflow foundation ready</Typography>
          <Typography color="text.secondary">
            This area is connected to the platform navigation and will use the same guided
            selections, audit history, permissions, and reliable system states.
          </Typography>
          <Button endIcon={<ArrowForwardRounded />}>View recommended next action</Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
