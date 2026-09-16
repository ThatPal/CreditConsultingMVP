import { HomeExperience } from '../features/credit-center/HomeExperience';
import { WorkspaceBlockers } from '../components/common/WorkspaceBlockers';
import type { CreditWorkspaceRead } from '../queries/creditWorkspace';
import { LoadingSkeleton } from '../components/common/Feedback';
import { ReferenceQueryState } from '../components/common/ReferenceQueryState';
import { FocusOwner } from '../components/common/FocusOwner';
import { creditWorkspaceRefetchInterval } from '../queries/creditWorkspace';
import {
  ProfileCurrentnessNotice,
  type ProfileCurrentnessRead,
} from '../components/common/ProfileCurrentnessNotice';
import { ActionProgressDisplay } from '../components/common/ActionProgressDisplay';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import RouteOutlined from '@mui/icons-material/RouteOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import { designTokens } from '../theme';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { creditWorkspaceKeys } from '../queries/creditWorkspace';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import { Alert, Box, Button, Divider, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export type JourneyProjection = {
  workspace?: CreditWorkspaceRead;
  client: { id: string; firstName: string; lastName: string };
  goal: { goalType: string; scope: string; targetAmount: number | null } | null;
  journey: {
    id: string | null;
    status: string;
    startedAt: string | null;
    currentFocus: {
      code: string;
      title: string;
      detail: string | null;
      action: string;
      owner?: string;
      actionLabel?: string;
    };
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
    creditProfile: ProfileCurrentnessRead;
    plan: {
      status: string;
      openActionCount: number;
      completedActionCount?: number;
      totalActionCount?: number;
      progressPercent?: number | null;
    };
    appointment: {
      status: string;
      id?: string;
      startsAt?: string;
      timezone?: string;
      roundId?: string | null;
    };
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
  const focus = data.journey.currentFocus;
  const plan = data.foundations.plan;
  const hasPlan = plan.status !== 'NOT_AVAILABLE';
  const profileAvailable = ['PUBLISHED', 'CURRENT'].includes(data.foundations.creditProfile.status);
  const appointment = data.foundations.appointment;
  const hasAppointment = appointment.status === 'BOOKED' && Boolean(appointment.startsAt);
  return (
    <Stack spacing={4}>
      <Box
        component="section"
        aria-label="Your next step"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.6fr) minmax(240px, 1fr)' },
          border: 1,
          borderColor: 'divider',
          borderRadius: '20px',
          overflow: 'hidden',
          background: designTokens.gradient.focus,
          boxShadow: designTokens.shadow.glow,
          color: '#f3f8f6',
        }}
      >
        <Stack spacing={2.5} sx={{ p: { xs: 3, md: 5 }, alignItems: 'flex-start' }}>
          <FocusOwner owner={focus.owner} staff={staff} />
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 28, md: 36 },
              lineHeight: 1.18,
              fontWeight: 650,
              letterSpacing: '-0.025em',
              maxWidth: 580,
            }}
          >
            {focus.title}
          </Typography>
          {focus.detail && (
            <Typography sx={{ color: '#cee0dc', maxWidth: 520, lineHeight: 1.7 }}>
              {focus.detail}
            </Typography>
          )}
          {!staff && (
            <Button
              component={Link}
              to={focus.action}
              variant="contained"
              endIcon={<ArrowForwardRounded />}
              sx={{ boxShadow: designTokens.shadow.glow }}
            >
              {focus.actionLabel ?? 'View next step'}
            </Button>
          )}
        </Stack>
        <Stack
          spacing={2}
          sx={{
            p: { xs: 3, md: 5 },
            borderLeft: { md: '1px solid #ffffff20' },
            borderTop: { xs: '1px solid #ffffff20', md: 0 },
            justifyContent: 'center',
            background: designTokens.gradient.advisory,
            color: designTokens.color.focusText,
            '& .MuiTypography-root': { color: 'inherit' },
            '& .MuiButton-root': { color: designTokens.color.focusLink },
            '& .MuiButton-root:focus-visible': {
              outlineColor: designTokens.color.focusLink + ' !important',
            },
          }}
        >
          <Typography variant="overline" sx={{ color: '#cee0dc' }}>
            Desired credit amount
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: 38, md: 48 },
              lineHeight: 1,
              fontWeight: 500,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {data.goal?.targetAmount != null
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(data.goal.targetAmount)
              : 'Not set'}
          </Typography>
          <Typography sx={{ color: '#cee0dc' }}>
            {data.goal
              ? (names[data.goal.goalType] ?? readable(data.goal.goalType))
              : 'Set the amount you want to work toward.'}
          </Typography>
          {!staff && (
            <Button
              component={Link}
              to="/app/goals"
              sx={{ alignSelf: 'flex-start', color: '#d1edb5' }}
            >
              Review your goal <ArrowForwardRounded sx={{ ml: 1, fontSize: 18 }} />
            </Button>
          )}
        </Stack>
      </Box>
      <ProfileCurrentnessNotice profile={data.foundations.creditProfile} />
      <WorkspaceBlockers blockers={data.workspace?.blockers} />
      <Box component="section" aria-label="Your financial journey">
        <Typography variant="h3" sx={{ mb: 2 }}>
          Your working picture
        </Typography>
        <Grid
          container
          spacing={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: '24px',
            overflow: 'hidden',
            background: designTokens.gradient.data,
          }}
        >
          {[
            {
              label: 'Credit Profile',
              value: profileAvailable
                ? 'Published'
                : data.foundations.creditProfile.status === 'NOT_AVAILABLE'
                  ? 'Not available yet'
                  : readable(data.foundations.creditProfile.status),
              detail: data.foundations.creditProfile.effectiveAt
                ? `Profile dated ${new Date(data.foundations.creditProfile.effectiveAt).toLocaleDateString()}`
                : 'Your published credit facts will appear here.',
              href: '/app/credit-center',
              link: 'Open Credit Center',
            },
            {
              label: 'Plan actions remaining',
              value: hasPlan ? String(plan.openActionCount) : 'Not available yet',
              detail: hasPlan
                ? plan.status === 'STALE'
                  ? 'Your consultant is reviewing this Plan.'
                  : `${plan.completedActionCount ?? 0} completed · guidance and milestones counted separately`
                : 'Your consultant will publish your preparation steps.',
              href: '/app/plan',
              link: 'Open your Plan',
            },
            ...(hasAppointment
              ? [
                  {
                    label: 'Upcoming appointment',
                    value: new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      ...(appointment.timezone ? { timeZone: appointment.timezone } : {}),
                    }).format(new Date(appointment.startsAt!)),
                    detail: new Intl.DateTimeFormat('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short',
                      ...(appointment.timezone ? { timeZone: appointment.timezone } : {}),
                    }).format(new Date(appointment.startsAt!)),
                    href: appointment.roundId
                      ? '/app/rounds/' + appointment.roundId + '/schedule'
                      : '/app/support',
                    link: appointment.roundId ? 'View appointment' : 'Ask about your appointment',
                  },
                ]
              : []),
          ].map((record, index) => (
            <Grid
              key={record.label}
              size={{ xs: 12, md: hasAppointment ? 4 : 6 }}
              sx={{
                p: 3,
                pl: 3,
                borderLeft: { md: index ? 1 : 0 },
                borderBottom: { xs: index < (hasAppointment ? 2 : 1) ? 1 : 0, md: 0 },
                borderColor: 'divider',
              }}
            >
              <Stack spacing={1.5} sx={{ height: '100%', position: 'relative' }}>
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 44,
                      height: 44,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'primary.main',
                      background: designTokens.gradient.active,
                      borderRadius: '14px',
                    }}
                  >
                    {index === 0 ? (
                      <FactCheckOutlined />
                    ) : index === 1 ? (
                      <RouteOutlined />
                    ) : (
                      <EventOutlined />
                    )}
                  </Box>
                  {index === 1 && hasPlan && (
                    <Box sx={{ position: 'absolute', right: 0, top: 0 }}>
                      <ActionProgressDisplay percent={plan.progressPercent} compact />
                    </Box>
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ pr: index === 1 && plan.progressPercent != null ? '112px' : 0 }}
                >
                  {record.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: index === 1 && hasPlan ? 42 : 26,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {record.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {record.detail}
                </Typography>
                {!staff && (
                  <Button
                    component={Link}
                    to={record.href}
                    endIcon={<ArrowForwardRounded />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {record.link}
                  </Button>
                )}
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
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
                No application cycle is active. Your completed work and preparation history stay
                here.
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
          Your journey continues across application cycles. Completed work stays in your history as
          you prepare for what comes next.
        </Alert>
      )}
    </Stack>
  );
}

export function ClientHomePage() {
  const query = useQuery({
    queryKey: creditWorkspaceKeys.home(),
    refetchInterval: creditWorkspaceRefetchInterval,
    queryFn: () => apiRequest<JourneyProjection>('/api/v1/client/home'),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your strategy"
        title={query.data ? `Welcome back, ${query.data.client.firstName}` : 'Welcome back'}
        description="Your next step, your credit picture, and the work ahead."
      />
      {query.isLoading && <LoadingSkeleton label="Loading your Home overview" />}
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
      {query.data && <HomeExperience data={query.data} />}
    </Stack>
  );
}

export function ClientJourneyPage() {
  const query = useQuery({
    queryKey: creditWorkspaceKeys.journey(),
    refetchInterval: creditWorkspaceRefetchInterval,
    queryFn: () => apiRequest<JourneyProjection>('/api/v1/client/journey'),
  });
  if (query.isLoading) return <ReferenceQueryState title="Your journey" loading />;
  if (query.isError)
    return (
      <ReferenceQueryState
        title="Your journey"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Lifetime context"
        title="Your journey"
        description="Follow your current work and revisit earlier cycles and preparation periods."
      />
      <JourneySummary data={query.data!} />
    </Stack>
  );
}
