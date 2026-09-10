import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { SafeRecordView } from '../components/admin/SafeRecordView';
import { humanizeCode } from '../components/common/labels';
import { CollectionSurface } from '../components/common/CollectionSurface';

type Job = {
  id: string;
  clientId: string;
  status: string;
  currentAttempt: number;
  maxAttempts: number;
  failureCategory: string | null;
  failureCode: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  createdAt: string;
  processDefinition: { processKey: string; processVersion: number; modelProfile: string };
  _count: { outputs: number; artifacts: number };
};
const mutateJob = (id: string, action: 'retry' | 'cancel') =>
  apiRequest(`/api/v1/admin/ai/jobs/${id}/${action}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });

export function AdminAIJobsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const processKey = params.get('processKey') ?? '';
  const query = useInfiniteQuery({
    queryKey: ['admin-ai-jobs', status, processKey],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      apiRequest<{ jobs: Job[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/v1/admin/ai/jobs?limit=50${status ? `&status=${status}` : ''}${processKey ? `&processKey=${encodeURIComponent(processKey)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const jobs = query.data?.pages.flatMap((p) => p.jobs) ?? [];
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        title="AI job operations"
        description="Inspect durable runtime state and perform bounded recovery actions without accepting professional authority."
      />
      <DataNavigationToolbar
        searchLabel="Process key"
        searchPlaceholder="credit-report.extract"
        searchValue={processKey}
        onSearchChange={(v) => set('processKey', v)}
        resultLabel={`${jobs.length}${query.hasNextPage ? '+' : ''} jobs loaded`}
      >
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => set('status', e.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {[
            'QUEUED',
            'RUNNING',
            'SUCCEEDED',
            'RETRYABLE_FAILURE',
            'NON_RETRYABLE_FAILURE',
            'SCHEMA_INVALID',
            'STALE',
            'CANCELLED',
          ].map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </DataNavigationToolbar>
      {query.isError && <Alert severity="error">AI jobs could not be loaded.</Alert>}
      <CollectionSurface
        title="Durable job queue"
        mode="bounded"
        busy={query.isFetching}
        empty={!query.isLoading && jobs.length === 0}
        footer={
          query.hasNextPage ? (
            <Button variant="outlined" onClick={() => query.fetchNextPage()}>
              Load older jobs
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              End of the loaded durable job history.
            </Typography>
          )
        }
      >
        <Stack divider={<Divider flexItem />}>
          {jobs.map((job) => (
            <Stack
              data-collection-item
              tabIndex={0}
              key={job.id}
              sx={{ py: 2, gap: 1 }}
              direction={{ xs: 'column', md: 'row' }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {job.processDefinition.processKey} v{job.processDefinition.processVersion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(job.createdAt).toLocaleString()} · attempt {job.currentAttempt}/
                  {job.maxAttempts} · client-scoped job
                </Typography>
                {job.failureCode && (
                  <Typography variant="caption" color="error">
                    {job.failureCategory}: {job.failureCode}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label={humanizeCode(job.status)} size="small" />
                <Button component={Link} to={`/admin/ai/jobs/${job.id}`}>
                  Inspect
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
    </Stack>
  );
}

export function AdminAIJobDetailPage() {
  const { jobId = '' } = useParams();
  const qc = useQueryClient();
  const [action, setAction] = useState<'retry' | 'cancel' | null>(null);
  const query = useQuery({
    queryKey: ['admin-ai-job', jobId],
    queryFn: () =>
      apiRequest<{
        job: Job & {
          sourceVersions: unknown;
          inputEnvelope: string;
          outputs: unknown[];
          artifacts: unknown[];
        };
      }>(`/api/v1/admin/ai/jobs/${jobId}`),
  });
  const mutation = useMutation({
    mutationFn: (action: 'retry' | 'cancel') => mutateJob(jobId, action),
    onSuccess: () => {
      setAction(null);
      return qc.invalidateQueries({ queryKey: ['admin-ai-job', jobId] });
    },
  });
  const job = query.data?.job;
  if (query.isLoading) return <Typography>Loading AI job…</Typography>;
  if (query.isError)
    return (
      <RecoveryState
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/admin/ai/jobs"
        backLabel="Back to jobs"
      />
    );
  if (!job) return <Alert severity="info">This AI job is not available.</Alert>;
  const retryable = [
      'RETRYABLE_FAILURE',
      'NON_RETRYABLE_FAILURE',
      'SCHEMA_INVALID',
      'STALE',
    ].includes(job.status),
    cancellable = ['QUEUED', 'RETRYABLE_FAILURE'].includes(job.status);
  return (
    <Stack spacing={3}>
      <PageHeader
        title={`${job.processDefinition.processKey} · ${humanizeCode(job.status)}`}
        description={`Durable job ${job.id}`}
        actions={
          <Button component={Link} to="/admin/ai/jobs">
            Back to jobs
          </Button>
        }
      />
      {mutation.isError && (
        <Alert severity="error">The recovery action failed or the job state changed.</Alert>
      )}
      <SectionCard>
        <Stack spacing={1}>
          <Typography>
            Attempt {job.currentAttempt} of {job.maxAttempts}
          </Typography>
          <Typography>
            Related: {job.relatedEntityType} {job.relatedEntityId}
          </Typography>
          <Typography>
            Outputs: {job.outputs.length} · Artifacts: {job.artifacts.length}
          </Typography>
          {job.failureCode && (
            <Alert severity="warning">
              {job.failureCategory}: {job.failureCode}
            </Alert>
          )}
          <Stack direction="row" spacing={1}>
            <Button disabled={!retryable || mutation.isPending} onClick={() => setAction('retry')}>
              Retry
            </Button>
            <Button
              color="warning"
              disabled={!cancellable || mutation.isPending}
              onClick={() => setAction('cancel')}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Source versions</Typography>
        <Box sx={{ mt: 2 }}>
          <SafeRecordView record={(job.sourceVersions ?? {}) as Record<string, unknown>} />
        </Box>
      </SectionCard>
      <GovernedActionDialog
        open={Boolean(action)}
        title={action === 'retry' ? 'Retry durable AI job' : 'Cancel queued AI job'}
        effect={
          action === 'retry'
            ? 'A duplicate-safe recovery request will return this job to the durable queue. No AI output is automatically approved.'
            : 'The queued job will be cancelled if its canonical state still permits cancellation.'
        }
        context={`${job.processDefinition.processKey} · attempt ${job.currentAttempt} of ${job.maxAttempts}`}
        preview={{
          current: `${humanizeCode(job.status)} · attempt ${job.currentAttempt} of ${job.maxAttempts}`,
          proposed:
            action === 'retry' ? 'Queue one durable retry request' : 'Cancel this queued job',
          scope: `This job only; outputs remain unapproved and professional decisions remain human-owned.`,
          timing:
            action === 'retry'
              ? 'The worker applies the request when it next claims the job.'
              : 'Immediate only if the canonical job state still permits cancellation.',
          reversibility:
            action === 'retry'
              ? 'The retry request cannot be withdrawn after worker claim.'
              : 'Cancellation does not delete job history.',
          audit: 'The request, actor, prior state, and resulting durable state are recorded.',
        }}
        warning
        pending={mutation.isPending}
        {...(mutation.isError ? { error: mutation.error.message } : {})}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action) mutation.mutate(action);
        }}
        confirmLabel={action === 'retry' ? 'Queue retry' : 'Cancel job'}
      />
    </Stack>
  );
}

export function AdminAIProcessesPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-ai-processes'],
    queryFn: () =>
      apiRequest<{
        definitions: Array<{
          id: string;
          processKey: string;
          processVersion: number;
          enabled: boolean;
          modelProfile: string;
          inputSchemaVersion: number;
          outputSchemaVersion: number;
          instructionVersion: string;
          dataClassification: string;
          domainConsumer: string;
          retiredAt: string | null;
          _count: { jobs: number };
        }>;
      }>(`/api/v1/admin/ai/processes`),
  });
  const [processKey, setProcessKey] = useState('');
  const [modelProfile, setModelProfile] = useState('');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/ai/processes/${encodeURIComponent(processKey)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          modelProfile,
          inputSchemaVersion: 1,
          outputSchemaVersion: 1,
          instructionVersion: 'phase17-v1',
          maxAttempts: 3,
          dataClassification: 'SENSITIVE',
          allowedContext: ['canonical-source-records'],
          domainConsumer: 'operations',
          enabled: false,
          reason: 'Governed Admin configuration version',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ai-processes'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="AI process configuration"
        description="Versioned profile references and bounded context only. Provider credentials and professional authority are never configured here."
      />
      <Alert severity="info">
        New versions default to disabled. Schema-changing versions cannot be activated directly.
      </Alert>
      <SectionCard>
        <Typography variant="h6">Create reviewed draft version</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Process key"
            value={processKey}
            onChange={(e) => setProcessKey(e.target.value)}
          />
          <TextField
            label="Model profile reference"
            value={modelProfile}
            onChange={(e) => setModelProfile(e.target.value)}
          />
          <Button
            disabled={!processKey || !modelProfile || create.isPending}
            onClick={() => create.mutate()}
          >
            Create disabled version
          </Button>
        </Stack>
      </SectionCard>
      <CollectionSurface
        title="Version history"
        mode="history"
        busy={query.isFetching}
        empty={!query.isLoading && !query.data?.definitions.length}
      >
        <Stack divider={<Divider flexItem />}>
          {query.data?.definitions.map((item) => (
            <Stack data-collection-item tabIndex={0} key={item.id} sx={{ py: 2 }}>
              <Stack direction="row" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>
                  {item.processKey} v{item.processVersion}
                </Typography>
                <Chip size="small" label={item.enabled ? 'Enabled' : 'Disabled'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {item.modelProfile} · input v{item.inputSchemaVersion} / output v
                {item.outputSchemaVersion} · {item._count.jobs} jobs
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
    </Stack>
  );
}
