import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import {
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

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
  return (
    <Stack spacing={2}>
      <SectionCard variant="elevated">
        <Stack spacing={1.5}>
          <Chip label="Current focus" color="primary" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="h2">{data.journey.currentFocus.title}</Typography>
          {data.journey.currentFocus.detail && (
            <Typography color="text.secondary">{data.journey.currentFocus.detail}</Typography>
          )}
          {!staff && (
            <Button
              component={Link}
              to={data.journey.currentFocus.action}
              variant="contained"
              endIcon={<ArrowForwardRounded />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Continue
            </Button>
          )}
        </Stack>
      </SectionCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard>
            <Typography variant="overline">Goal</Typography>
            <Typography variant="h3">
              {data.goal ? (names[data.goal.goalType] ?? readable(data.goal.goalType)) : 'Not set'}
            </Typography>
            <Typography color="text.secondary">
              {data.goal ? readable(data.goal.scope) : 'Choose a goal to begin.'}
            </Typography>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard>
            <Typography variant="overline">Credit profile</Typography>
            <Typography variant="h3">{readable(data.foundations.creditProfile.status)}</Typography>
            <Typography color="text.secondary">Only verified review state is shown.</Typography>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard>
            <Typography variant="overline">Plan & appointments</Typography>
            <Typography variant="h3">
              {data.foundations.plan.status === 'AVAILABLE'
                ? `${data.foundations.plan.openActionCount} open actions`
                : 'Not available yet'}
            </Typography>
            <Typography color="text.secondary">
              Appointments: {readable(data.foundations.appointment.status)}
            </Typography>
          </SectionCard>
        </Grid>
      </Grid>
      {showHistory && <SectionCard>
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
                    ? (names[cycle.goalSnapshot.goalType] ?? readable(cycle.goalSnapshot.goalType))
                    : 'Historical snapshot unavailable'}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>
      </SectionCard>}
      {showHistory && <SectionCard>
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
                {readable(cycle.status)} · started {new Date(cycle.startedAt).toLocaleDateString()}
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
      </SectionCard>}
      {showHistory && <Alert severity="info">
        Future journey stages appear only after their canonical workflow creates them. No approval,
        score, or outcome is guaranteed.
      </Alert>}
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
        <Alert severity="error">Your current journey context could not be loaded.</Alert>
      )}
      {query.data && <JourneySummary data={query.data} showHistory={false} />}
      {query.data && (
        <SectionCard>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <Stack sx={{ flex: 1 }}>
              <Typography variant="h3">Journey timeline</Typography>
              <Typography color="text.secondary">
                Review your active cycle, completed cycles, and preparation history.
              </Typography>
            </Stack>
            <Button component={Link} to="/app/journey" variant="outlined" endIcon={<HistoryRounded />}>
              View journey
            </Button>
          </Stack>
        </SectionCard>
      )}
      {!query.data && (
        <Grid container spacing={2}>
          {[
            { title: 'Credit Center', path: '/app/credit-center' },
            { title: 'Documents', path: '/app/documents' },
            { title: 'Support', path: '/app/support' },
          ].map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <SectionCard>
                <Typography variant="h3">{item.title}</Typography>
                <Button component={Link} to={item.path}>
                  Open
                </Button>
              </SectionCard>
            </Grid>
          ))}
        </Grid>
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
