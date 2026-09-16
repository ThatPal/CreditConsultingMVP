import { designTokens } from '../theme';
import { PlanRoadmap, planStepUrl } from '../features/plans/PlanRoadmap';
import { PlanFollowUp } from '../features/plans/PlanFollowUp';
import {
  creditWorkspaceKeys,
  type PlanSummaryRead,
  type CreditWorkspaceRead,
} from '../queries/creditWorkspace';
import { useEffect, useState } from 'react';
import { ResponseWritePause, usePendingNavigationWork } from '../NavigationProtection';
import { PlanDraftLibrary } from '../features/plans/PlanDraftLibrary';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { StatusChip } from '../components/common/StatusChip';
import { presentStatus } from '../components/common/statusVocabulary';
import { CollectionSurface } from '../components/common/CollectionSurface';
import {
  DraftPublicationStatus,
  ProgressArc,
  WaitingState,
} from '../components/common/ProductFoundation';
import { SavedPlanResponse } from '../features/plans/SavedPlanResponse';
import { ResponseHistory, type ResponseItem } from '../features/plans/PlanResponse';
import type { PlanItem as Item } from '../features/plans/editor';

export type ClientPlanItem = ResponseItem & {
  availability?: {
    canRespond: boolean;
    canSubmitCompletion: boolean;
    canRequestHelp: boolean;
    reason: string | null;
  };
  stableKey?: string;
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
  summary?: PlanSummaryRead;
  workspace?: CreditWorkspaceRead;
  plan: null | {
    id: string;
    title: string;
    status: string;
    version: { version?: number; staleAt: string | null; items: ClientPlanItem[] };
  };
};

function PlanStepTarget({ itemId }: { itemId: string | null }) {
  useEffect(() => {
    if (!itemId) return;
    const target = document.getElementById('plan-item-' + itemId);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
  }, [itemId]);
  return null;
}
export function ClientPlanPage() {
  const [search] = useSearchParams();
  const view = ['actions', 'guidance'].includes(search.get('view') ?? '')
    ? search.get('view')!
    : 'overview';
  const query = useQuery({
    queryKey: creditWorkspaceKeys.plan(),
    queryFn: () => apiRequest<ClientPlanResponse>('/api/v1/client/plan'),
  });
  const pending = usePendingNavigationWork();
  const [snapshot, setSnapshot] = useState<ClientPlanResponse | undefined>(undefined);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const holding = pending.dirty || pending.busy;
  useEffect(() => {
    if (!holding && query.data) setSnapshot(query.data);
  }, [holding, query.data]);
  const data = holding && snapshot ? snapshot : query.data;
  const updateWaiting = holding && Boolean(snapshot) && query.data !== snapshot;
  if (query.isLoading && !data) return <Typography>Loading your Plan…</Typography>;
  if (query.isError && !holding)
    return <RecoveryState error={query.error} onRetry={() => void query.refetch()} />;
  if (!data?.plan)
    return (
      <Stack spacing={2}>
        <PageHeader
          eyebrow="Plan"
          title="Your next steps"
          description="An approved Plan will appear here when it is ready."
        />
        <Alert severity="info">No approved Plan is available yet.</Alert>
        <PlanDraftLibrary />
      </Stack>
    );
  const plan = data.plan;
  const summary = data.summary;
  // A missing projection is read-only, never reconstructed from browser items.
  const canAct = summary?.canRespond === true;
  const currentFocus = plan.version.items.find((item) => item.id === summary?.nextClientItem?.id);
  const allItems = plan.version.items.filter((item) => item.status !== 'CANCELLED');
  const visibleItems = allItems.filter((item) =>
    view === 'actions' ? item.type === 'ACTION' : item.type !== 'ACTION',
  );
  return (
    <ResponseWritePause.Provider value={updateWaiting}>
      <Stack spacing={3}>
        {!summary && (
          <Alert severity="warning">
            The current Plan status is unavailable. Refresh before continuing; saved work remains
            available below.
          </Alert>
        )}
        {updateWaiting && (
          <Alert
            severity="warning"
            action={
              <Button disabled={pending.busy} onClick={() => setConfirmUpdate(true)}>
                Review Plan update
              </Button>
            }
          >
            Your Plan changed while this response was in progress. Your unsaved text is still here.
            New saves and submissions are paused until you load the update.
          </Alert>
        )}
        {query.isError && holding && (
          <Alert severity="error">
            The latest Plan could not be loaded. Your current answers remain here.
          </Alert>
        )}
        <Dialog
          open={confirmUpdate}
          onClose={() => {
            if (!pending.busy) setConfirmUpdate(false);
          }}
          aria-label="Load updated Plan"
        >
          <DialogTitle>Load the updated Plan?</DialogTitle>
          <DialogContent>
            {pending.dirty
              ? 'Copy any unsaved text you want to keep before continuing. Loading the update discards those local edits. Successfully saved drafts remain in the saved response library.'
              : 'Your saved responses remain in the saved response library.'}
          </DialogContent>
          <DialogActions>
            <Button disabled={pending.busy} onClick={() => setConfirmUpdate(false)}>
              Keep my answers open
            </Button>
            <Button
              disabled={pending.busy || !query.data}
              onClick={() => {
                setSnapshot(query.data);
                setConfirmUpdate(false);
              }}
            >
              Load updated Plan
            </Button>
          </DialogActions>
        </Dialog>
        <PageHeader
          eyebrow="Your plan"
          title={plan.title}
          description="Your consultant’s guidance, your next actions, and the work you’ve completed."
          actions={<PlanDraftLibrary />}
        />
        <Stack
          component="nav"
          aria-label="Credit Plan views"
          direction="row"
          sx={{ gap: 1, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}
        >
          {(
            [
              ['overview', 'Overview'],
              ['actions', 'Actions'],
              ['guidance', 'Guidance'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              component={Link}
              to={key === 'overview' ? '/app/plan' : '/app/plan?view=' + key}
              aria-current={view === key ? 'page' : undefined}
              sx={{
                borderRadius: 0,
                borderBottom: 2,
                borderColor: view === key ? 'primary.main' : 'transparent',
              }}
            >
              {label}
            </Button>
          ))}
        </Stack>
        {plan.version.staleAt && (
          <Alert severity="warning">
            This Plan is being reviewed after a source change. Completed history remains available.
          </Alert>
        )}
        <Box
          component="section"
          aria-label="Current Plan focus"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            p: { xs: 2.5, md: 4 },
            background: designTokens.gradient.focus,
            boxShadow: designTokens.shadow.glow,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <Typography variant="overline">Current focus</Typography>
              <Typography variant="h3">
                {data.workspace?.currentFocus.title ?? 'Your Plan status'}
              </Typography>
              <Typography color="text.secondary">
                {data.workspace?.currentFocus.detail ??
                  'Your guidance and saved work are shown below.'}
              </Typography>
              {data.workspace && !data.workspace.currentFocus.action.startsWith('/app/plan') && (
                <Button
                  component={Link}
                  to={data.workspace.currentFocus.action}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {data.workspace.currentFocus.actionLabel}
                </Button>
              )}
              <Typography variant="body2">
                {summary
                  ? `Actions remaining: ${summary.openActionCount} · ${summary.completedActionCount} of ${summary.totalActionCount} actions completed`
                  : 'Action counts unavailable'}
              </Typography>
              {currentFocus && ['AVAILABLE', 'IN_PROGRESS'].includes(currentFocus.status) && (
                <Stack
                  direction="row"
                  aria-label="Current Plan action"
                  sx={{ gap: 1, flexWrap: 'wrap', mt: 1 }}
                >
                  <Button
                    component={Link}
                    to={planStepUrl(currentFocus)}
                    variant="contained"
                    aria-label={'Go to step: ' + currentFocus.title}
                    onClick={() => {
                      if (search.get('item') === currentFocus.id) {
                        const target = document.getElementById('plan-item-' + currentFocus.id);
                        target?.focus({ preventScroll: true });
                        target?.scrollIntoView({ block: 'start' });
                      }
                    }}
                  >
                    Go to current step
                  </Button>

                  <Button component={Link} to="/app/support?new=1&category=PLAN" variant="outlined">
                    Ask for help
                  </Button>
                </Stack>
              )}
              <DraftPublicationStatus
                state="published"
                {...(plan.version.version ? { version: plan.version.version } : {})}
                owner="Your consultant"
              />
            </Stack>
            {view === 'overview' && summary?.progressPercent != null && (
              <>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <ProgressArc value={summary.progressPercent} label="Action progress" />
                </Box>
                <Stack spacing={1} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                  <Typography variant="caption" color="text.secondary">
                    Action progress · {summary.progressPercent}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={summary.progressPercent}
                    aria-label="Action progress"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Stack>
              </>
            )}
          </Stack>
        </Box>
        {data.workspace?.currentFocus.code === 'PLAN_VERIFICATION' && (
          <WaitingState
            prerequisite="Your submitted Plan response is awaiting verification"
            owner="Your consultant"
            unavailable="The dependent Plan step"
            userMustAct={false}
          />
        )}
        {view === 'overview' ? (
          <PlanRoadmap items={allItems} />
        ) : (
          <>
            <PlanStepTarget key={view} itemId={search.get('item')} />
            {search.get('item') && !visibleItems.some((item) => item.id === search.get('item')) && (
              <Alert severity="info">
                This step is not available in the current Plan view. Review the overview for your
                published steps.
              </Alert>
            )}
            {!visibleItems.length && (
              <Typography color="text.secondary">
                {view === 'actions'
                  ? 'No Actions are included in this published Plan. Guidance and milestones are available in their own view.'
                  : 'No guidance or milestones are included in this published Plan.'}
              </Typography>
            )}
            <CollectionSurface
              title={`Plan steps · ${visibleItems.length}`}
              mode="bounded"
              appearance="plain"
              {...(!search.get('item') && plan.version.version
                ? {
                    scrollKey: JSON.stringify(['client-plan', plan.id, plan.version.version, view]),
                  }
                : {})}
            >
              {visibleItems.map((item) => (
                <Box
                  key={item.id}
                  id={`plan-item-${item.id}`}
                  tabIndex={-1}
                  role="group"
                  aria-label={item.title}
                  sx={{ borderBottom: 1, borderColor: 'divider', scrollMarginTop: 100, py: 1 }}
                >
                  <Box sx={{ py: 2, px: { xs: 0, md: 1 } }}>
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
                      <Typography sx={{ whiteSpace: 'pre-wrap', maxWidth: 800, lineHeight: 1.7 }}>
                        {item.body}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Owner:{' '}
                        {['AWAITING_VERIFICATION', 'UNABLE'].includes(item.status)
                          ? 'Your consultant'
                          : item.owner === 'CLIENT'
                            ? 'You'
                            : item.owner === 'CONSULTANT'
                              ? 'Your consultant'
                              : 'System'}
                        {item.dueAt
                          ? ` · Timing: ${new Date(item.dueAt).toLocaleDateString()}`
                          : ''}
                      </Typography>
                      {item.prerequisites.length > 0 && item.status === 'LOCKED' && (
                        <Typography color="text.secondary">
                          Available after:{' '}
                          {item.prerequisites.map((value) => value.title).join(', ')}
                        </Typography>
                      )}
                      {item.deepLink && (
                        <Button component={Link} to={item.deepLink}>
                          Go to the related step
                        </Button>
                      )}
                      {item.availability?.reason === 'VERIFICATION_REQUIRED' && (
                        <Typography color="text.secondary">
                          This step requires consultant or system verification. You do not need to
                          submit a response.
                        </Typography>
                      )}
                      <PlanFollowUp
                        item={item}
                        canAct={canAct && item.availability?.canRespond === true}
                      />
                      {item.owner === 'CLIENT' &&
                        ['AVAILABLE', 'IN_PROGRESS'].includes(item.status) &&
                        item.type !== 'MILESTONE' && (
                          <SavedPlanResponse
                            key={`response:${item.id}:${item.latestOutcomeId}`}
                            item={item}
                            readOnly={!canAct || item.availability?.canRespond !== true}
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
                  </Box>
                </Box>
              ))}
            </CollectionSurface>
          </>
        )}
      </Stack>
    </ResponseWritePause.Provider>
  );
}
