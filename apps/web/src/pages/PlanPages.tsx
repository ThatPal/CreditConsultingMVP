import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { StatusChip } from '../components/common/StatusChip';
import { presentStatus } from '../components/common/statusVocabulary';
import { CollectionSurface } from '../components/common/CollectionSurface';
import {
  ArchetypeCanvas,
  DependencyMap,
  DraftPublicationStatus,
  ProgressArc,
  StickyActionBar,
  WaitingState,
} from '../components/common/ProductFoundation';

type Item = {
  stableKey: string;
  type: 'ACTION' | 'GUIDANCE' | 'MILESTONE';
  completionMode:
    | 'ACKNOWLEDGEMENT'
    | 'STRUCTURED_OUTCOME'
    | 'CLIENT_REPORT_CONSULTANT_VERIFY'
    | 'CONSULTANT_VERIFY'
    | 'SYSTEM_VERIFY';
  owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM';
  clientTitle: string;
  clientBody: string | null;
  consultantRationale: string | null;
  sortOrder: number;
  required: boolean;
  pathKeys: string[];
};

type BuilderResponse = {
  plan: null | {
    id: string;
    status: string;
    versions: Array<{
      version: number;
      optimisticVersion: number;
      sourceProfileVersion: number | null;
      items: Array<{
        stableKey: string;
        type: Item['type'];
        completionMode: Item['completionMode'];
        owner: Item['owner'];
        clientTitle: string;
        clientBody: string | null;
        consultantRationale: string | null;
        sortOrder: number;
        required: boolean;
        pathMemberships: Array<{ path: { key: string } }>;
      }>;
    }>;
    title: string;
  };
  context: { review: null | { id: string } };
};

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

const starterItems: Item[] = [
  {
    stableKey: 'review-guidance',
    type: 'GUIDANCE',
    completionMode: 'ACKNOWLEDGEMENT',
    owner: 'CLIENT',
    clientTitle: 'Review your credit findings',
    clientBody: 'Read the published findings before beginning your preparation actions.',
    consultantRationale: 'Establish shared context.',
    sortOrder: 0,
    required: true,
    pathKeys: [],
  },
  {
    stableKey: 'utilization-outcome',
    type: 'ACTION',
    completionMode: 'STRUCTURED_OUTCOME',
    owner: 'CLIENT',
    clientTitle: 'Report your balance progress',
    clientBody: 'Record the balance change after your planned payment.',
    consultantRationale: 'Captures an outcome without replacing the account record.',
    sortOrder: 1,
    required: true,
    pathKeys: [],
  },
  {
    stableKey: 'consultant-check',
    type: 'MILESTONE',
    completionMode: 'CONSULTANT_VERIFY',
    owner: 'CONSULTANT',
    clientTitle: 'Consultant verifies readiness',
    clientBody: 'Your consultant will confirm when this milestone is satisfied.',
    consultantRationale: 'Authoritative verification.',
    sortOrder: 2,
    required: true,
    pathKeys: [],
  },
];

export function ConsultantPlanBuilderPage() {
  const { clientId = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['plan-builder', clientId],
    queryFn: () => apiRequest<BuilderResponse>(`/api/v1/consultant/clients/${clientId}/plan`),
    enabled: Boolean(clientId),
  });
  const [title, setTitle] = useState('Credit preparation plan');
  const [items, setItems] = useState<Item[]>(starterItems);
  useEffect(() => {
    const plan = query.data?.plan;
    const version = plan?.versions[0];
    if (!plan || !version) return;
    setTitle(plan.title);
    setItems(
      version.items.map((item) => ({
        ...item,
        pathKeys: item.pathMemberships.map(({ path }) => path.key),
      })),
    );
  }, [query.data?.plan?.id, query.data?.plan?.versions?.[0]?.optimisticVersion]);
  const draft = useMemo(
    () => ({
      title,
      purpose: 'PREPARATION',
      sourceReviewId: query.data?.context.review?.id ?? null,
      sourceReviewVersion: 1,
      sourceGoalRevisionId: null,
      sourceProfileVersion: 1,
      items,
      dependencies:
        items.length > 1
          ? items.slice(1).map((item, index) => ({
              dependentKey: item.stableKey,
              prerequisiteKey: items[index]!.stableKey,
              mode: 'ALL',
            }))
          : [],
    }),
    [items, query.data, title],
  );
  const save = useMutation({
    mutationFn: async () => {
      const plan = query.data?.plan;
      if (!plan)
        return apiRequest(`/api/v1/consultant/clients/${clientId}/plans`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        });
      const version = plan.versions[0];
      if (!version) throw new Error('Plan version is unavailable');
      return apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: version.optimisticVersion, draft }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-builder', clientId] }),
  });
  const approve = useMutation({
    mutationFn: () => {
      const plan = query.data?.plan;
      if (!plan) throw new Error('Plan is unavailable');
      return apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${plan.id}/approve`, {
        method: 'POST',
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-builder', clientId] }),
  });
  const reconcile = useMutation({
    mutationFn: () => {
      const plan = query.data?.plan;
      const version = plan?.versions[0];
      if (!plan || !version) throw new Error('Plan version is unavailable');
      return apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${plan.id}/reconcile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceProfileVersion: (version.sourceProfileVersion ?? 0) + 1,
          material: true,
          reason: 'Consultant confirmed a material source change.',
        }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-builder', clientId] }),
  });
  if (query.isLoading) return <Typography>Loading Plan Builder…</Typography>;
  if (query.isError)
    return <Alert severity="error">The Plan Builder could not be loaded safely.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Client plan"
        title="Plan Builder"
        description="Build a typed, dependency-aware client Plan. Display order never changes prerequisite truth."
      />
      {save.isError && (
        <Alert severity="error">
          The draft could not be saved. Reload if another editor changed this Plan.
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Plan title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Stack direction="row" spacing={1}>
              <Chip label={`Status: ${query.data?.plan?.status ?? 'NEW'}`} />
              <Chip label={`Version: ${query.data?.plan?.versions?.[0]?.version ?? 1}`} />
            </Stack>
            <Box
              data-testid="plan-three-zone-workbench"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: '230px minmax(0, 1fr) 320px' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box
                component="aside"
                aria-label="Plan structure"
                sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}
              >
                <Typography variant="h6">Plan structure</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Dependencies follow this canonical order. Reordering changes display order, not
                  prerequisite truth.
                </Typography>
                <Stack spacing={1} component="ol" sx={{ pl: 2 }}>
                  {items.map((item, index) => (
                    <Typography component="li" key={item.stableKey} variant="body2">
                      {index + 1}. {item.clientTitle}
                    </Typography>
                  ))}
                </Stack>
              </Box>
              <Stack spacing={2} aria-label="Plan item authoring">
            {items.map((item, index) => (
              <Card key={item.stableKey} variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <TextField
                        select
                        label="Type"
                        value={item.type}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((candidate, i) =>
                              i === index
                                ? { ...candidate, type: event.target.value as Item['type'] }
                                : candidate,
                            ),
                          )
                        }
                      >
                        {['ACTION', 'GUIDANCE', 'MILESTONE'].map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Client title"
                        fullWidth
                        value={item.clientTitle}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((candidate, i) =>
                              i === index
                                ? { ...candidate, clientTitle: event.target.value }
                                : candidate,
                            ),
                          )
                        }
                      />
                    </Stack>
                    <TextField
                      label="Client guidance"
                      multiline
                      value={item.clientBody ?? ''}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((candidate, i) =>
                            i === index
                              ? { ...candidate, clientBody: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="Consultant-only rationale"
                      multiline
                      value={item.consultantRationale ?? ''}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((candidate, i) =>
                            i === index
                              ? { ...candidate, consultantRationale: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        disabled={index === 0}
                        onClick={() =>
                          setItems((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                            return next.map((value, i) => ({ ...value, sortOrder: i }));
                          })
                        }
                      >
                        Move up
                      </Button>
                      <Button
                        color="error"
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <Button
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    ...starterItems[0]!,
                    stableKey: `item-${crypto.randomUUID()}`,
                    clientTitle: 'New guidance',
                    sortOrder: current.length,
                  },
                ])
              }
            >
              Add typed item
            </Button>
              </Stack>
              <Box
                component="aside"
                aria-label="Plan context and client preview"
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  position: { xl: 'sticky' },
                  top: { xl: 16 },
                }}
              >
                <DraftPublicationStatus
                  state={query.data?.plan?.status === 'APPROVED' ? 'published' : 'draft'}
                  version={query.data?.plan?.versions?.[0]?.version ?? 1}
                  owner="Consultant"
                />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Client-safe preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  This is what the client will understand after approval. Consultant rationale is
                  never included.
                </Typography>
                <Stack spacing={1.5}>
                  {items.map((item) => (
                    <Box key={item.stableKey}>
                      <Typography sx={{ fontWeight: 700 }}>{item.clientTitle}</Typography>
                      <Typography color="text.secondary">{item.clientBody}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
            <Divider />
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
                Save draft
              </Button>
              <Button
                variant="contained"
                color="success"
                disabled={!query.data?.plan || approve.isPending}
                onClick={() => approve.mutate()}
              >
                Approve Plan
              </Button>
              <Button
                disabled={!query.data?.plan || reconcile.isPending}
                onClick={() => reconcile.mutate()}
              >
                Reconcile source change
              </Button>
            </Stack>
            <Typography variant="caption">
              Approval requires recent MFA step-up. Manual authoring remains available without AI.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

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
  const currentFocus = plan.version.items.find((item) =>
    ['AVAILABLE', 'IN_PROGRESS', 'AWAITING_VERIFICATION'].includes(item.status),
  );
  const completed = plan.version.items.filter((item) =>
    ['COMPLETED', 'VERIFIED'].includes(item.status),
  ).length;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your plan"
        title={plan.title}
        description="Follow the available steps. Locked milestones open only when their prerequisites are satisfied."
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
      <ArchetypeCanvas archetype="guided-decision" role="client">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={1.5} sx={{ flex: 1 }}>
            <Typography variant="overline">Current focus</Typography>
            <Typography variant="h3">
              {currentFocus?.title ?? 'Waiting for the next verified step'}
            </Typography>
            <Typography color="text.secondary">
              {currentFocus?.body ??
                'Completed history remains preserved while your consultant prepares the next action.'}
            </Typography>
            <Typography variant="body2">
              Path progress: {completed} of {plan.version.items.length} steps completed
            </Typography>
            <DraftPublicationStatus
              state="published"
              {...(plan.version.version ? { version: plan.version.version } : {})}
              owner="Your consultant"
            />
          </Stack>
          <ProgressArc
            value={plan.version.items.length ? (completed / plan.version.items.length) * 100 : 0}
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
      <DependencyMap
        title="Plan readiness"
        items={plan.version.items
          .slice(0, 5)
          .map((item) => ({
            label: item.title,
            ready: ['COMPLETED', 'VERIFIED', 'AVAILABLE', 'IN_PROGRESS'].includes(item.status),
          }))}
      />
      <Typography variant="h3">Guidance, actions & milestones</Typography>
      <CollectionSurface title={`Plan actions · ${plan.version.items.length}`} mode="bounded">
        {plan.version.items.map((item) => (
          <Card key={item.id} id={`plan-item-${item.id}`}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="h6">{item.title}</Typography>
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
                {item.status === 'AVAILABLE' && item.type !== 'MILESTONE' && (
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
          </Card>
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
                document
                  .getElementById(`plan-item-${currentFocus.id}`)
                  ?.scrollIntoView({ behavior: 'smooth' })
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
