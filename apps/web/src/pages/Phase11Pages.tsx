import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { RecoveryState, RecordContext } from '../components/common/InteractionPatterns';
import {
  ArchetypeCanvas,
  FreshnessIndicator,
  LifecycleRail,
  StickyActionBar,
} from '../components/common/ProductFoundation';

type CycleView = {
  cycle: null | {
    id: string;
    displayName: string | null;
    status: 'ACTIVE' | 'PAUSED';
    goalSnapshot: null | { goalType: string; scope: string; targetAmount: string | null };
    creditCardRounds: Array<{ id: string }>;
  };
  currentGoal: null | {
    goalType: string;
    scope: string;
    targetAmount: string | null;
    version: number;
  };
  profileState: null | { status: string; updatedAt: string };
  blockers: string[];
  canStartOrResume: boolean;
  currentRoundId: string | null;
};
type RoundView = {
  round: {
    id: string;
    status: string;
    cycle: { displayName: string | null };
    goalSnapshot: { goalType: string; scope: string; targetAmount: string | null };
    preparationPlanVersion: null | {
      items: Array<{ id: string; clientTitle: string; status: string; required: boolean }>;
    };
    serviceEntitlement: { status: string };
  };
  readiness: {
    profileCurrent: boolean;
    preparationComplete: boolean;
    majorCheckComplete: boolean;
    coordinationRequired: boolean;
    strategyReady: boolean;
    blockers: string[];
  };
  majorCheck: null | {
    choice: string;
    intendedTiming: string | null;
    clientContext: string | null;
    version: number;
  };
  lifecycle: {
    currentState: string;
    meaning: string;
    owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM' | 'ADMIN' | 'NONE';
    mustActNow: boolean;
    waiting: string | null;
    freshness: string;
    stages: Array<{
      key: string;
      label: string;
      state: 'COMPLETED' | 'ACTIVE' | 'AVAILABLE' | 'LOCKED';
      path: string;
    }>;
  };
  primaryAction: null | { key: string; label: string; path: string };
};

const readable = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

export function SeasonalCyclePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['seasonal-cycle'],
    queryFn: () => apiRequest<CycleView>('/api/v1/client/seasonal-cycle'),
  });
  const start = useMutation({
    mutationFn: () =>
      apiRequest<{ result: { cycleId: string } }>('/api/v1/client/seasonal-cycle/start-or-resume', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seasonal-cycle'] }),
  });
  const pause = useMutation({
    mutationFn: (cycleId: string) =>
      apiRequest(`/api/v1/client/seasonal-cycle/${cycleId}/pause`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seasonal-cycle'] }),
  });
  const createRound = useMutation({
    mutationFn: (cycleId: string) =>
      apiRequest<{ view: RoundView }>(`/api/v1/client/seasonal-cycle/${cycleId}/rounds`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      }),
    onSuccess: (data) => navigate(`/app/rounds/${data.view.round.id}`),
  });
  if (query.isLoading)
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress />
        <Typography>Loading your seasonal cycle…</Typography>
      </Stack>
    );
  if (query.isError || !query.data)
    return <Alert severity="error">We could not load your seasonal cycle. Try again.</Alert>;
  const { cycle, currentGoal, profileState, blockers } = query.data;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Seasonal planning"
        title={cycle?.displayName ?? 'Start your next credit season'}
        description="Confirm today’s goal and Credit Profile before beginning a paid card-application round."
      />
      {blockers.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button
              component={Link}
              to={
                blockers.includes('PRIMARY_GOAL_REQUIRED')
                  ? '/app/goals'
                  : '/app/credit-center/review'
              }
            >
              Resolve
            </Button>
          }
        >
          {blockers.includes('PRIMARY_GOAL_REQUIRED')
            ? 'Confirm a primary goal before starting.'
            : 'A current published Credit Profile Review is required. Stale or incomplete reviews cannot be bypassed.'}
        </Alert>
      )}
      <SectionCard>
        <Typography variant="h5">Current context</Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline">Goal</Typography>
            <Typography>
              {currentGoal
                ? `${readable(currentGoal.goalType)} · ${readable(currentGoal.scope)}${currentGoal.targetAmount ? ` · $${Number(currentGoal.targetAmount).toLocaleString()}` : ''}`
                : 'No primary goal confirmed'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="overline">Credit Profile</Typography>
            <Chip
              label={profileState ? readable(profileState.status) : 'Not available'}
              color={profileState?.status === 'CURRENT' ? 'success' : 'warning'}
            />
          </Box>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h5">
          {cycle ? (cycle.displayName ?? 'Current seasonal cycle') : 'Ready to begin?'}
        </Typography>
        <Stack spacing={2}>
          {cycle?.goalSnapshot && (
            <Typography>
              Your frozen cycle goal is {readable(cycle.goalSnapshot.goalType)}. Later goal edits
              will not rewrite this historical snapshot.
            </Typography>
          )}
          {!cycle && (
            <Typography>
              Starting creates one immutable goal snapshot and makes this season your current
              Journey focus.
            </Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {(!cycle || cycle.status === 'PAUSED') && (
              <Button
                variant="contained"
                disabled={!query.data.canStartOrResume || start.isPending}
                onClick={() => start.mutate()}
              >
                {cycle ? 'Resume seasonal cycle' : 'Start seasonal cycle'}
              </Button>
            )}
            {cycle?.status === 'ACTIVE' && !query.data.currentRoundId && (
              <Button
                variant="contained"
                disabled={createRound.isPending}
                onClick={() => createRound.mutate(cycle.id)}
              >
                Start paid card round
              </Button>
            )}
            {query.data.currentRoundId && (
              <Button
                variant="contained"
                component={Link}
                to={`/app/rounds/${query.data.currentRoundId}`}
              >
                Continue current round
              </Button>
            )}
            {cycle?.status === 'ACTIVE' && (
              <Button
                variant="outlined"
                disabled={pause.isPending}
                onClick={() => pause.mutate(cycle.id)}
              >
                Pause cycle
              </Button>
            )}
          </Stack>
          {(start.error || pause.error || createRound.error) && (
            <Alert severity="error">
              {(start.error ?? pause.error ?? createRound.error)?.message}
            </Alert>
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function RoundPage() {
  const { roundId = '' } = useParams();
  const query = useQuery({
    queryKey: ['round', roundId],
    queryFn: () => apiRequest<RoundView>(`/api/v1/client/rounds/${roundId}`),
    enabled: Boolean(roundId),
  });
  if (query.isLoading)
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  if (query.isError || !query.data)
    return (
      <RecoveryState
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/app/application-rounds"
        backLabel="Back to rounds"
      />
    );
  const { round, readiness, lifecycle, primaryAction, majorCheck } = query.data;
  const checks = [
    readiness.profileCurrent,
    readiness.preparationComplete,
    readiness.majorCheckComplete,
  ];
  return (
    <Stack spacing={3}>
      <RecordContext
        breadcrumbs={[
          { label: 'Application rounds', to: '/app/application-rounds' },
          { label: round.cycle.displayName ?? 'Current round' },
        ]}
        title="Credit Card Round"
        meta={
          <Typography color="text.secondary">
            Payment provides access. Your current profile and major-credit context govern every next
            step.
          </Typography>
        }
      />
      <LinearProgress
        aria-label="Round preparation progress"
        variant="determinate"
        value={(checks.filter(Boolean).length / checks.length) * 100}
      />
      <ArchetypeCanvas archetype="lifecycle-timeline" role="client">
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary">
            Current focus
          </Typography>
          <Typography variant="h2">{lifecycle.currentState}</Typography>
          <Typography color="text.secondary">{lifecycle.waiting ?? lifecycle.meaning}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={`Owner: ${readable(String(lifecycle.owner ?? 'NONE'))}`}
              variant="outlined"
            />
            <FreshnessIndicator
              state="confirmed"
              at={
                lifecycle.freshness && !Number.isNaN(Date.parse(lifecycle.freshness))
                  ? lifecycle.freshness
                  : undefined
              }
            />
          </Stack>
        </Stack>
      </ArchetypeCanvas>
      <SectionCard>
        <Typography variant="h5">Round facts</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip label={`Entitlement: ${readable(round.serviceEntitlement.status)}`} />
          <Chip
            label={`Profile: ${readiness.profileCurrent ? 'Current' : 'Review required'}`}
            color={readiness.profileCurrent ? 'success' : 'warning'}
          />
          <Chip
            label={
              readiness.strategyReady ? 'Ready for consultant strategy' : 'Preparation in progress'
            }
            color={readiness.strategyReady ? 'success' : 'default'}
          />
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h5">Readiness / Review</Typography>
        <Typography>
          {readiness.profileCurrent
            ? 'Your published profile is current for this Round.'
            : 'Your profile changed or became stale. Complete a new Review before strategy preparation.'}
        </Typography>
      </SectionCard>
      <SectionCard>
        <Typography variant="h5">Preparation Plan</Typography>
        <Stack spacing={1}>
          {round.preparationPlanVersion?.items.length ? (
            round.preparationPlanVersion.items.map((item) => (
              <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography>{item.clientTitle}</Typography>
                <Chip size="small" label={readable(item.status)} />
              </Stack>
            ))
          ) : (
            <Typography>No preparation actions are required by the current shared Plan.</Typography>
          )}
          <Button component={Link} to="/app/plan">
            Open shared Plan
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h5">Major Application Check</Typography>
        <Typography>
          {majorCheck
            ? `${readable(majorCheck.choice)}${readiness.coordinationRequired ? ' · consultant coordination requested' : ''}`
            : 'Tell us about any upcoming mortgage, auto, student, or other major financing before strategy begins.'}
        </Typography>
      </SectionCard>
      <SectionCard>
        <LifecycleRail
          title="Round path"
          items={lifecycle.stages.map(({ key, label, state }) => ({ key, label, state }))}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          {lifecycle.stages
            .filter((stage) => stage.state !== 'LOCKED')
            .map((stage) => (
              <Button
                key={stage.key}
                component={Link}
                to={stage.path}
                variant={stage.state === 'ACTIVE' ? 'contained' : 'text'}
              >
                {stage.state === 'ACTIVE' ? `Continue ${stage.label}` : `Review ${stage.label}`}
              </Button>
            ))}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h5">Next action</Typography>
        <Typography color="text.secondary">
          {lifecycle.waiting ??
            (lifecycle.mustActNow
              ? 'This is the next action supported by the current Round state.'
              : `The next step is owned by ${readable(lifecycle.owner)}.`)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Updated {new Date(lifecycle.freshness).toLocaleString()}
        </Typography>
      </SectionCard>
      {primaryAction && (
        <StickyActionBar label="Authoritative Round action">
          <Button variant="contained" component={Link} to={primaryAction.path}>
            {primaryAction.label}
          </Button>
        </StickyActionBar>
      )}
    </Stack>
  );
}

export function MajorApplicationCheckPage() {
  const { roundId = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [choice, setChoice] = useState('NO');
  const [timing, setTiming] = useState('');
  const [context, setContext] = useState('');
  const query = useQuery({
    queryKey: ['round', roundId],
    queryFn: () => apiRequest<RoundView>(`/api/v1/client/rounds/${roundId}`),
    enabled: Boolean(roundId),
  });
  const submit = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/client/rounds/${roundId}/major-check`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          choice,
          intendedTiming: choice === 'NO' ? null : timing,
          clientContext: choice === 'NO' ? null : context,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['round', roundId] });
      navigate(`/app/rounds/${roundId}`);
    },
  });
  if (query.isLoading) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">This Round is unavailable.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={query.data?.round.cycle.displayName ?? 'Current round'}
        title="Major application check"
        description="Do you expect to apply for a major loan or other major credit in the near future? This context helps your consultant coordinate timing; it is not an automatic stop/proceed decision."
      />
      {query.data?.majorCheck && (
        <Alert severity="info">
          Your latest answer is {readable(query.data.majorCheck.choice)}. Submitting a material
          update creates a new auditable version.
        </Alert>
      )}
      <SectionCard>
        <Typography variant="h5">Your plans</Typography>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel>Expected major credit</FormLabel>
            <RadioGroup value={choice} onChange={(event) => setChoice(event.target.value)}>
              {[
                ['NO', 'No'],
                ['MORTGAGE', 'Yes — Mortgage'],
                ['AUTO', 'Yes — Auto'],
                ['STUDENT', 'Yes — Student'],
                ['OTHER_MAJOR_FINANCING', 'Yes — Other major financing'],
                ['NOT_SURE', 'Not sure'],
              ].map(([value, label]) => (
                <FormControlLabel key={value} value={value} control={<Radio />} label={label} />
              ))}
            </RadioGroup>
          </FormControl>
          {choice !== 'NO' && (
            <>
              <TextField
                label="Approximate timing"
                value={timing}
                onChange={(event) => setTiming(event.target.value)}
                required
                helperText="For example: within 3 months, or Spring 2027"
              />
              <TextField
                label="Optional context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                multiline
                minRows={3}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
                helperText="Do not enter lender passwords, account numbers, or full application data."
              />
            </>
          )}
          {submit.error && <Alert severity="error">{submit.error.message}</Alert>}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={submit.isPending || (choice !== 'NO' && !timing.trim())}
              onClick={() => submit.mutate()}
            >
              Save and return to Round
            </Button>
            <Button component={Link} to={`/app/rounds/${roundId}`}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
