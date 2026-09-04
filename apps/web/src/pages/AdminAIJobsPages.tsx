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
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

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
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {jobs.map((job) => (
            <Stack key={job.id} sx={{ py: 2, gap: 1 }} direction={{ xs: 'column', md: 'row' }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {job.processDefinition.processKey} v{job.processDefinition.processVersion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(job.createdAt).toLocaleString()} · attempt {job.currentAttempt}/
                  {job.maxAttempts} · client {job.clientId}
                </Typography>
                {job.failureCode && (
                  <Typography variant="caption" color="error">
                    {job.failureCategory}: {job.failureCode}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label={job.status} size="small" />
                <Button component={Link} to={`/admin/ai/jobs/${job.id}`}>
                  Inspect
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
      {query.hasNextPage && (
        <Button variant="outlined" onClick={() => query.fetchNextPage()}>
          Load older jobs
        </Button>
      )}
    </Stack>
  );
}

export function AdminAIJobDetailPage() {
  const { jobId = '' } = useParams();
  const qc = useQueryClient();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ai-job', jobId] }),
  });
  const job = query.data?.job;
  if (query.isLoading) return <Typography>Loading AI job…</Typography>;
  if (!job) return <Alert severity="error">AI job could not be loaded.</Alert>;
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
        title={`${job.processDefinition.processKey} · ${job.status}`}
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
            <Button
              disabled={!retryable || mutation.isPending}
              onClick={() => {
                if (confirm('Retry this job through the durable queue?')) mutation.mutate('retry');
              }}
            >
              Retry
            </Button>
            <Button
              color="warning"
              disabled={!cancellable || mutation.isPending}
              onClick={() => {
                if (confirm('Cancel this queued job?')) mutation.mutate('cancel');
              }}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Source versions</Typography>
        <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {JSON.stringify(job.sourceVersions, null, 2)}
        </Box>
      </SectionCard>
    </Stack>
  );
}
