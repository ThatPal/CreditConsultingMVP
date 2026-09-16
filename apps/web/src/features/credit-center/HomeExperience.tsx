import { HomeCreditSnapshot } from './HomeCreditSnapshot';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { Link } from 'react-router-dom';
import type { JourneyProjection } from '../../pages/JourneyPages';
import { FocusOwner } from '../../components/common/FocusOwner';
import { WorkspaceBlockers } from '../../components/common/WorkspaceBlockers';
import { ProfileCurrentnessNotice } from '../../components/common/ProfileCurrentnessNotice';
import { ActionProgressDisplay } from '../../components/common/ActionProgressDisplay';
import { designTokens } from '../../theme';

export function HomeExperience({ data }: { data: JourneyProjection }) {
  const focus = data.workspace?.currentFocus ?? data.journey.currentFocus;
  const plan = data.workspace?.plan ?? data.foundations.plan;
  const appointment = data.foundations.appointment;
  const goal = data.goal;
  const goalNames: Record<string, string> = {
    ZERO_APR_CREDIT: 'Build 0% APR credit',
    TOTAL_AVAILABLE_CREDIT: 'Increase total available credit',
    BUSINESS_CREDIT: 'Build business credit',
    PERSONAL_CREDIT: 'Build personal credit',
    BALANCE_TRANSFER_CAPACITY: 'Create balance-transfer capacity',
    EXISTING_LIMIT_INCREASES: 'Increase existing limits',
    REWARDS_POINTS_PORTFOLIO: 'Build a rewards portfolio',
  };
  const current = data.journey.cycles.find((c) => c.timelineGroup === 'CURRENT');
  const activity = data.journey.cycles.filter((c) => c.closedAt).slice(0, 3);
  return (
    <Stack spacing={4}>
      <Box
        component="section"
        aria-label="Your next step"
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 3,
          background: designTokens.gradient.focus,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="overline">What matters now</Typography>
          <FocusOwner owner={focus.owner} />
          <Typography variant="h2" sx={{ maxWidth: 780, fontSize: { xs: 30, md: 40 } }}>
            {focus.title}
          </Typography>
          <Typography sx={{ maxWidth: 760, lineHeight: 1.75 }}>{focus.detail}</Typography>
          <Button
            component={Link}
            to={focus.action}
            variant="contained"
            endIcon={<ArrowForwardRounded />}
          >
            {focus.actionLabel ?? 'View next step'}
          </Button>
        </Stack>
      </Box>
      <WorkspaceBlockers blockers={data.workspace?.blockers} />
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 4, py: 1 }}
      >
        <Box>
          <Typography variant="overline" color="primary">
            Goal & Journey
          </Typography>
          <Typography component="h2" variant="h3" sx={{ my: 1 }}>
            {goal
              ? (goalNames[goal.goalType] ?? goal.goalType.replaceAll('_', ' ').toLowerCase())
              : 'Define what you want to work toward'}
          </Typography>
          {goal?.targetAmount != null && (
            <Typography sx={{ fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(goal.targetAmount)}
            </Typography>
          )}
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {current
              ? `${current.displayName ?? 'Current cycle'} · ${current.currentStage.replaceAll('_', ' ').toLowerCase()}`
              : 'Your Journey connects your goals, preparation and completed work.'}
          </Typography>
          <Button component={Link} to="/app/journey" sx={{ mt: 1 }}>
            View goal & Journey
          </Button>
        </Box>
        {appointment.status === 'BOOKED' && appointment.startsAt && (
          <Box sx={{ borderLeft: { md: 1 }, borderColor: 'divider', pl: { md: 3 } }}>
            <Typography variant="overline">Upcoming appointment</Typography>
            <Typography variant="h3" component="h2" sx={{ my: 1 }}>
              {new Date(appointment.startsAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                ...(appointment.timezone ? { timeZone: appointment.timezone } : {}),
              })}
            </Typography>
            <Typography color="text.secondary">
              {new Date(appointment.startsAt).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
                ...(appointment.timezone ? { timeZone: appointment.timezone } : {}),
              })}
            </Typography>
            <Button
              component={Link}
              to={
                appointment.roundId
                  ? '/app/rounds/' + appointment.roundId + '/schedule'
                  : '/app/support'
              }
            >
              View appointment context
            </Button>
          </Box>
        )}
      </Box>
      <Box
        component="section"
        sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 3 }}
      >
        <Typography variant="overline">Credit snapshot</Typography>
        <Typography variant="h3" component="h2" sx={{ my: 1 }}>
          {['PUBLISHED', 'CURRENT'].includes(data.foundations.creditProfile.status)
            ? 'Your published credit picture'
            : 'Build your Credit Center'}
        </Typography>
        <ProfileCurrentnessNotice profile={data.foundations.creditProfile} />
        <HomeCreditSnapshot />
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {data.foundations.creditProfile.effectiveAt
            ? 'Profile dated ' +
              new Date(data.foundations.creditProfile.effectiveAt).toLocaleDateString()
            : 'Your reviewed credit facts and consultant assessment will appear in Credit Center.'}
        </Typography>
        <Button component={Link} to="/app/credit-center" endIcon={<ArrowForwardRounded />}>
          Open Credit Center
        </Button>
      </Box>
      <Box
        component="section"
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 3 }}
      >
        <Box>
          <Typography variant="overline">Plan snapshot</Typography>
          <Typography variant="h3" component="h2" sx={{ my: 1 }}>
            Your work ahead
          </Typography>
          <Typography>
            {plan.status === 'NOT_AVAILABLE'
              ? 'Your consultant will publish the next steps here.'
              : `Actions remaining: ${plan.openActionCount} · ${plan.completedActionCount ?? 'Not available'} completed`}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {data.workspace?.plan.nextClientItem?.title ??
              'Your current focus above identifies who owns the next step.'}
          </Typography>
          <Button component={Link} to="/app/credit-center/plan" endIcon={<ArrowForwardRounded />}>
            View Plan in Credit Center
          </Button>
        </Box>
        {plan.progressPercent != null && <ActionProgressDisplay percent={plan.progressPercent} />}
      </Box>
      {current && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
          <Typography variant="h3" component="h2">
            Active service context
          </Typography>
          <Typography color="text.secondary">
            {current.displayName ?? 'Current application cycle'} ·{' '}
            {current.status.replaceAll('_', ' ').toLowerCase()}
          </Typography>
          <Button component={Link} to="/app/journey">
            View this work in your Journey
          </Button>
        </Box>
      )}
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
        <Typography variant="h3" component="h2">
          Recent activity
        </Typography>
        {activity.length ? (
          activity.map((c) => (
            <Typography key={c.id} sx={{ mt: 2 }}>
              {c.displayName ?? 'Application cycle'} · {new Date(c.closedAt!).toLocaleDateString()}{' '}
              · {c.status.replaceAll('_', ' ').toLowerCase()}
            </Typography>
          ))
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            No completed cycle activity is available yet.
          </Typography>
        )}
        <Button component={Link} to="/app/journey">
          View Journey history
        </Button>
      </Box>
    </Stack>
  );
}
