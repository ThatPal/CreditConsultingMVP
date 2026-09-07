import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import { Alert, Button, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import {
  ArchetypeCanvas,
  CurrentStateSummary,
  LifecycleRail,
  MetricHero,
  WaitingState,
} from '../components/common/ProductFoundation';

export type JourneyProjection = {
  client: { id: string; firstName: string; lastName: string };
  goal: { goalType: string; scope: string; targetAmount: number | null } | null;
  journey: {
    id: string | null;
    status: string;
    startedAt: string | null;
    currentFocus: { code: string; title: string; detail: string | null; action: string };
    cycles: Array<{
      id: string;
      cycleNumber: number;
      displayName: string | null;
      status: string;
      currentStage: string;
      startedAt: string;
      closedAt: string | null;
      finalResult: string | null;
      timelineGroup: 'CURRENT' | 'HISTORY';
      goalSnapshot: {
        goalType: string;
        scope: string;
        targetAmount: number | null;
        capturedAt: string;
      } | null;
    }>;
    nurturePeriods: Array<{
      id: string;
      status: string;
      reasonCode: string;
      startedAt: string;
      endedAt: string | null;
    }>;
    historyWindow?: { limit: number; cycleTotal: number; nurturePeriodTotal: number };
  };
  foundations: {
    creditProfile: { status: string; effectiveAt?: string | null };
    plan: { status: string; openActionCount: number };
    appointment: { status: string };
  };
};

const names: Record<string, string> = {
  ZERO_APR_CREDIT: 'Build 0% APR credit',
  TOTAL_AVAILABLE_CREDIT: 'Increase total available credit',
  BUSINESS_CREDIT: 'Build business credit',
  PERSONAL_CREDIT: 'Build personal credit',
  BALANCE_TRANSFER_CAPACITY: 'Create balance-transfer capacity',
  EXISTING_LIMIT_INCREASES: 'Increase existing limits',
  REWARDS_POINTS_PORTFOLIO: 'Build a rewards portfolio',
};
const readable = (value: string) => value.replaceAll('_', ' ').toLowerCase();

export function JourneySummary({
  data,
  staff = false,
  showHistory = true,
}: {
  data: JourneyProjection;
  staff?: boolean;
  showHistory?: boolean;
}) {
  const current = data.journey.cycles.filter((cycle) => cycle.timelineGroup === 'CURRENT');
  const history = data.journey.cycles.filter((cycle) => cycle.timelineGroup === 'HISTORY');
  const foundationStages = [
    {
      key: 'review',
      label: 'Credit Review',
      ready: data.foundations.creditProfile.status !== 'NOT_AVAILABLE',
    },
    {
      key: 'profile',
      label: 'Understand your Credit Profile',
      ready:
        data.foundations.creditProfile.status === 'PUBLISHED' ||
        data.foundations.creditProfile.status === 'CURRENT',
    },
    { key: 'plan', label: 'Follow your Plan', ready: data.foundations.plan.status === 'AVAILABLE' },
    { key: 'cycle', label: 'Prepare for an Application Cycle', ready: current.length > 0 },
  ];
  const activeIndex = Math.max(
    0,
    foundationStages.findIndex((stage) => !stage.ready),
  );
  return (
    <Stack spacing={2}>
      <CurrentStateSummary
        state={data.journey.currentFocus.title}
        meaning={
          data.journey.currentFocus.detail ??
          'This is the next verified step in your credit strategy.'
        }
        owner={staff ? 'Client' : 'You'}
        asOf={
          data.journey.cycles.find((cycle) => cycle.timelineGroup === 'CURRENT')?.startedAt ??
          data.foundations.creditProfile.effectiveAt ??
          undefined
        }
        action={
          !staff ? (
            <Button
              component={Link}
              to={data.journey.currentFocus.action}
              variant="contained"
              endIcon={<ArrowForwardRounded />}
            >
              Continue {data.journey.currentFocus.title}
            </Button>
          ) : undefined
        }
      />
      <ArchetypeCanvas archetype="financial-dashboard" role={staff ? 'consultant' : 'client'}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricHero
              label="Your goal"
              value={
                data.goal ? (names[data.goal.goalType] ?? readable(data.goal.goalType)) : 'Not set'
              }
              explanation={
                data.goal
                  ? `${readable(data.goal.scope)} scope${data.goal.targetAmount ? ` · factual target $${data.goal.targetAmount.toLocaleString()}` : ''}`
                  : 'Choose a goal before planning begins.'
              }
              source="Saved goal"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricHero
              label="Credit Profile"
              value={readable(data.foundations.creditProfile.status)}
              explanation="This is the latest consultant-published financial foundation for your Plan."
              source="Published Credit Review"
              {...(data.foundations.creditProfile.effectiveAt
                ? { asOf: data.foundations.creditProfile.effectiveAt }
                : {})}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricHero
              label="Plan actions"
              value={
                data.foundations.plan.status === 'AVAILABLE'
                  ? data.foundations.plan.openActionCount
                  : 'Waiting'
              }
              explanation={`Appointments: ${readable(data.foundations.appointment.status)}. Your Plan owns preparation actions.`}
              source="Approved Plan"
            />
          </Grid>
        </Grid>
      </ArchetypeCanvas>
      <ArchetypeCanvas archetype="lifecycle-timeline" role={staff ? 'consultant' : 'client'}>
        <LifecycleRail
          title="Your financial journey"
          items={foundationStages.map((stage, index) => ({
            key: stage.key,
            label: stage.label,
            state: stage.ready ? 'COMPLETED' : index === activeIndex ? 'ACTIVE' : 'LOCKED',
            detail: stage.ready
              ? 'Canonical milestone available'
              : index === activeIndex
                ? staff
                  ? 'Client or consultant owns this current prerequisite'
                  : 'This is the current prerequisite'
                : 'Available only after earlier verified work',
          }))}
        />
      </ArchetypeCanvas>
      {data.foundations.plan.status !== 'AVAILABLE' && (
        <WaitingState
          prerequisite="Your approved Plan is not ready yet"
          owner="Your consultant"
          unavailable="Plan actions"
          userMustAct={false}
        />
      )}
      {showHistory && (
        <SectionCard>
          <Stack spacing={2} divider={<Divider />}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <RouteRounded color="primary" />
              <Typography variant="h3">Current cycle</Typography>
            </Stack>
            {data.journey.historyWindow &&
              (data.journey.historyWindow.cycleTotal > data.journey.cycles.length ||
                data.journey.historyWindow.nurturePeriodTotal >
                  data.journey.nurturePeriods.length) && (
                <Alert severity="info">
                  Showing the {data.journey.historyWindow.limit} most recent journey records. Older
                  records remain preserved in the authoritative history.
                </Alert>
              )}
            {current.length === 0 ? (
              <Alert severity="info">
                No application cycle is active. Future steps are not inferred.
              </Alert>
            ) : (
              current.map((cycle) => (
                <Stack key={cycle.id} spacing={0.5}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {cycle.displayName ?? `Cycle ${cycle.cycleNumber}`}
                  </Typography>
                  <Typography color="text.secondary">
                    Current stage: {readable(cycle.currentStage)}
                  </Typography>
                  <Typography variant="caption">
                    Goal at cycle start:{' '}
                    {cycle.goalSnapshot
                      ? (names[cycle.goalSnapshot.goalType] ??
                        readable(cycle.goalSnapshot.goalType))
                      : 'Historical snapshot unavailable'}
                  </Typography>
                </Stack>
              ))
            )}
          </Stack>
        </SectionCard>
      )}
      {showHistory && (
        <SectionCard>
          <Stack spacing={2} divider={<Divider />}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <HistoryRounded color="primary" />
              <Typography variant="h3">Journey history</Typography>
            </Stack>
            {history.length === 0 &&
            data.journey.nurturePeriods.filter((p) => p.status !== 'ACTIVE').length === 0 ? (
              <Typography color="text.secondary">
                No completed cycles or preparation periods yet.
              </Typography>
            ) : null}
            {history.map((cycle) => (
              <Stack key={cycle.id}>
                <Typography sx={{ fontWeight: 700 }}>
                  {cycle.displayName ?? `Cycle ${cycle.cycleNumber}`}
                </Typography>
                <Typography color="text.secondary">
                  {readable(cycle.status)} · started{' '}
                  {new Date(cycle.startedAt).toLocaleDateString()}
                </Typography>
              </Stack>
            ))}
            {data.journey.nurturePeriods.map((period) => (
              <Stack key={period.id}>
                <Typography sx={{ fontWeight: 700 }}>Preparation period</Typography>
                <Typography color="text.secondary">
                  {readable(period.reasonCode)} · {readable(period.status)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      )}
      {showHistory && (
        <Alert severity="info">
          Future journey stages appear only after their canonical workflow creates them. No
          approval, score, or outcome is guaranteed.
        </Alert>
      )}
    </Stack>
  );
}

export function ClientHomePage() {
  const query = useQuery({
    queryKey: ['portal-home'],
    queryFn: () => apiRequest<JourneyProjection>('/api/v1/client/home'),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your strategy"
        title={query.data ? `Welcome back, ${query.data.client.firstName}` : 'Welcome back'}
        description="Your verified current focus and the next honest step."
      />
      {query.isLoading && <LinearProgress />}
      {query.isError && (
        <Alert severity="error">
          <Stack spacing={1}>
            <Typography>
              Your current journey context could not be loaded. No saved work was changed.
            </Typography>
            <Button variant="outlined" onClick={() => query.refetch()}>
              Try loading your journey again
            </Button>
          </Stack>
        </Alert>
      )}
      {query.data && <JourneySummary data={query.data} showHistory={false} />}
      {query.data && (
        <SectionCard>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Stack sx={{ flex: 1 }}>
              <Typography variant="h3">Journey timeline</Typography>
              <Typography color="text.secondary">
                Review your active cycle, completed cycles, and preparation history.
              </Typography>
            </Stack>
            <Button
              component={Link}
              to="/app/journey"
              variant="outlined"
              endIcon={<HistoryRounded />}
            >
              Review your journey timeline
            </Button>
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

export function ClientJourneyPage() {
  const query = useQuery({
    queryKey: ['portal-journey'],
    queryFn: () => apiRequest<JourneyProjection>('/api/v1/client/journey'),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError) return <Alert severity="error">Your journey could not be loaded.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Lifetime context"
        title="Your journey"
        description="Current work, read-only history, and only the future states that actually exist."
      />
      <JourneySummary data={query.data!} />
    </Stack>
  );
}
