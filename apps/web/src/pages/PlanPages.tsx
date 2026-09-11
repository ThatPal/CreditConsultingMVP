import { Alert, Box, Button, CardContent, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { StatusChip } from '../components/common/StatusChip';
import { presentStatus } from '../components/common/statusVocabulary';
import { CollectionSurface } from '../components/common/CollectionSurface';
import {
  ArchetypeCanvas,
  DraftPublicationStatus,
  ProgressArc,
  StickyActionBar,
  WaitingState,
} from '../components/common/ProductFoundation';
import { SavedPlanResponse } from '../features/plans/SavedPlanResponse';
import { ResponseHistory, type ResponseItem } from '../features/plans/PlanResponse';
import type { PlanItem as Item } from '../features/plans/editor';
export { ConsultantPlanBuilderPage } from '../features/plans/ConsultantPlanBuilderPage';

export type ClientPlanItem = ResponseItem & {
  id: string;
  type: Item['type'];
  completionMode: Item['completionMode'];
  status: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  prerequisites: Array<{ id: string; title: string; status: string }>;
  owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM';
  dueAt?: string | null;
};

export type ClientPlanResponse = {
  plan: null | {
    id: string;
    title: string;
    status: string;
    version: { version?: number; staleAt: string | null; items: ClientPlanItem[] };
  };
};

export function ClientPlanPage() {
  const query = useQuery({
    queryKey: ['client-plan'],
    queryFn: () => apiRequest<ClientPlanResponse>('/api/v1/client/plan'),
  });
  if (query.isLoading) return <Typography>Loading your Plan…</Typography>;
  if (query.isError)
    return <RecoveryState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data?.plan)
    return (
      <Stack spacing={2}>
        <PageHeader
          eyebrow="Plan"
          title="Your next steps"
          description="An approved Plan will appear here when it is ready."
        />
        <Alert severity="info">No approved Plan is available yet.</Alert>
      </Stack>
    );
  const plan = query.data.plan;
  const canAct = plan.status === 'ACTIVE' && !plan.version.staleAt;
  const currentFocus = canAct
    ? (plan.version.items.find(
        (item) =>
          item.owner === 'CLIENT' &&
          item.type !== 'MILESTONE' &&
          ['AVAILABLE', 'IN_PROGRESS'].includes(item.status),
      ) ??
      plan.version.items.find((item) => ['AWAITING_VERIFICATION', 'UNABLE'].includes(item.status)))
    : undefined;
  const visibleItems = plan.version.items.filter((item) => item.status !== 'CANCELLED');
  const openActions = visibleItems.filter(
    (item) => item.type === 'ACTION' && item.status !== 'COMPLETED',
  ).length;
  const completed = visibleItems.filter((item) =>
    ['COMPLETED', 'VERIFIED'].includes(item.status),
  ).length;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your plan"
        title={plan.title}
        description="Your preparation steps, supporting guidance, and consultant checkpoints in one place."
      />
      {plan.version.staleAt && (
        <Alert severity="warning">
          This Plan is being reviewed after a source change. Completed history remains available.
        </Alert>
      )}
      <ArchetypeCanvas
        archetype="guided-decision"
        role="client"
        sx={{ borderRadius: { xs: '20px', md: '20px' } }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={1.5} sx={{ flex: 1 }}>
            <Typography variant="overline">Current focus</Typography>
            <Typography variant="h3">
              {plan.status === 'STALE'
                ? 'Your consultant is reviewing this Plan'
                : (currentFocus?.title ??
                  (completed === visibleItems.length && visibleItems.length > 0
                    ? 'Your Plan steps are complete'
                    : 'Your consultant owns the next step'))}
            </Typography>
            <Typography color="text.secondary">
              {(currentFocus?.status === 'UNABLE'
                ? 'Your consultant will reply with guidance before you continue this step. Your help request is saved below.'
                : currentFocus?.body) ??
                (completed === visibleItems.length && visibleItems.length > 0
                  ? 'Your completed work is saved below. Return Home to see what comes next in your journey.'
                  : 'Check the owner and status of each remaining step below.')}
            </Typography>
            <Typography variant="body2">
              Actions remaining: {openActions} · {completed} of {visibleItems.length} total steps
              completed
            </Typography>
            <DraftPublicationStatus
              state="published"
              {...(plan.version.version ? { version: plan.version.version } : {})}
              owner="Your consultant"
            />
          </Stack>
          <ProgressArc
            value={visibleItems.length ? (completed / visibleItems.length) * 100 : 0}
            label="Plan progress"
          />
        </Stack>
      </ArchetypeCanvas>
      {currentFocus?.status === 'AWAITING_VERIFICATION' && (
        <WaitingState
          prerequisite={`${currentFocus.title} is awaiting verification`}
          owner="Your consultant"
          unavailable="The dependent Plan step"
          userMustAct={false}
        />
      )}
      <Typography variant="h3">Guidance, actions & milestones</Typography>
      <CollectionSurface title={`Plan steps · ${visibleItems.length}`} mode="bounded">
        {visibleItems.map((item) => (
          <Box
            key={item.id}
            id={`plan-item-${item.id}`}
            sx={{ borderBottom: 1, borderColor: 'divider', scrollMarginTop: 100, py: 1 }}
          >
            <CardContent>
              <Stack spacing={1}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
                >
                  <Stack>
                    <Typography variant="overline" color="text.secondary">
                      {item.type.toLowerCase()}
                    </Typography>
                    <Typography variant="h6">{item.title}</Typography>
                  </Stack>
                  <StatusChip
                    {...(item.status === 'UNABLE'
                      ? { label: 'Help requested', tone: 'info' as const }
                      : presentStatus(item.status))}
                  />
                </Stack>
                <Typography>{item.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Owner:{' '}
                  {['AWAITING_VERIFICATION', 'UNABLE'].includes(item.status)
                    ? 'Your consultant'
                    : item.owner === 'CLIENT'
                      ? 'You'
                      : item.owner === 'CONSULTANT'
                        ? 'Your consultant'
                        : 'System'}
                  {item.dueAt ? ` · Timing: ${new Date(item.dueAt).toLocaleDateString()}` : ''}
                </Typography>
                {item.prerequisites.length > 0 && item.status === 'LOCKED' && (
                  <Typography color="text.secondary">
                    Available after: {item.prerequisites.map((value) => value.title).join(', ')}
                  </Typography>
                )}
                {item.deepLink && (
                  <Button component={Link} to={item.deepLink}>
                    Go to the related step
                  </Button>
                )}
                {canAct &&
                  item.owner === 'CLIENT' &&
                  ['AVAILABLE', 'IN_PROGRESS'].includes(item.status) &&
                  item.type !== 'MILESTONE' && (
                    <SavedPlanResponse
                      key={`response:${item.id}:${item.latestOutcomeId}`}
                      item={item}
                    />
                  )}
                <ResponseHistory key={`${item.id}:${item.latestOutcomeId}`} item={item} />
                {item.status === 'UNABLE' && (
                  <Alert severity="info">
                    Your help request is saved. Your consultant owns the next step.
                  </Alert>
                )}
                {item.status === 'AWAITING_VERIFICATION' && (
                  <Alert severity="info">
                    Your update was recorded and is awaiting consultant verification.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Box>
        ))}
      </CollectionSurface>
      {currentFocus && currentFocus.status === 'AVAILABLE' && (
        <StickyActionBar label="Current Plan action">
          {currentFocus.deepLink ? (
            <Button component={Link} to={currentFocus.deepLink} variant="contained">
              Start {currentFocus.title}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() =>
                document.getElementById(`plan-item-${currentFocus.id}`)?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
                })
              }
            >
              Start {currentFocus.title}
            </Button>
          )}
          <Button component={Link} to="/app/support?new=1&category=PLAN" variant="outlined">
            Ask for help with this Plan
          </Button>
        </StickyActionBar>
      )}
    </Stack>
  );
}
