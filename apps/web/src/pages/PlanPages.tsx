import { useState } from 'react';
import { Alert, Box, Button, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { PlanItem as Item } from '../features/plans/editor';
export { ConsultantPlanBuilderPage } from '../features/plans/ConsultantPlanBuilderPage';

type ClientPlanItem = {
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

type ClientPlanResponse = {
  plan: null | {
    id: string;
    title: string;
    status: string;
    version: { version?: number; staleAt: string | null; items: ClientPlanItem[] };
  };
};

export function ClientPlanPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['client-plan'],
    queryFn: () => apiRequest<ClientPlanResponse>('/api/v1/client/plan'),
  });
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const act = useMutation({
    mutationFn: ({ item, action }: { item: ClientPlanItem; action: 'COMPLETE' | 'UNABLE' }) =>
      apiRequest(`/api/v1/client/plan/items/${item.id}/outcomes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          action,
          ...(action === 'UNABLE'
            ? { reason: outcomes[item.id] || 'I need help completing this step.' }
            : item.completionMode === 'STRUCTURED_OUTCOME'
              ? { outcome: { clientReport: outcomes[item.id] } }
              : {}),
        }),
      }),
    onSuccess: () => {
      setOutcomes((current) => {
        const next = { ...current };
        delete next[act.variables?.item.id ?? ''];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['client-plan'] });
    },
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
  const canAct = ['ACTIVE', 'APPROVED'].includes(plan.status) && !plan.version.staleAt;
  const currentFocus = canAct
    ? (plan.version.items.find(
        (item) =>
          item.owner === 'CLIENT' &&
          item.type !== 'MILESTONE' &&
          ['AVAILABLE', 'IN_PROGRESS'].includes(item.status),
      ) ?? plan.version.items.find((item) => item.status === 'AWAITING_VERIFICATION'))
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
      {act.isError && (
        <Alert severity="error">
          That outcome was not accepted. Reload the Plan and check prerequisite or verification
          requirements.
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
              {currentFocus?.body ??
                (completed === visibleItems.length && visibleItems.length > 0
                  ? 'Your completed work is saved below. Return Home to see what comes next in your journey.'
                  : 'Your completed work is saved below. Check the owner and status of each remaining step.')}
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
                  <StatusChip {...presentStatus(item.status)} />
                </Stack>
                <Typography>{item.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Owner:{' '}
                  {item.owner === 'CLIENT'
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
                    <Stack spacing={1}>
                      <TextField
                        label={
                          item.completionMode === 'STRUCTURED_OUTCOME'
                            ? 'What changed?'
                            : 'Optional note'
                        }
                        value={outcomes[item.id] ?? ''}
                        onChange={(event) =>
                          setOutcomes((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          disabled={
                            act.isPending ||
                            (item.completionMode === 'STRUCTURED_OUTCOME' &&
                              !outcomes[item.id]?.trim())
                          }
                          onClick={() => act.mutate({ item, action: 'COMPLETE' })}
                        >
                          {item.type === 'GUIDANCE' ? 'I understand' : 'Report complete'}
                        </Button>
                        <Button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ item, action: 'UNABLE' })}
                        >
                          I need help
                        </Button>
                      </Stack>
                    </Stack>
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
