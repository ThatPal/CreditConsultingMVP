import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { humanizeCode } from '../components/common/labels';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { CollectionSurface } from '../components/common/CollectionSurface';
type Definition = {
  id: string;
  key: string;
  taskType: string;
  schedule: string;
  enabled: boolean;
  maxRuntimeSec: number;
  runs: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    failureCode: string | null;
  }>;
};
export function AdminScheduledJobsPage() {
  const [selected, setSelected] = useState<Definition | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: () => apiRequest<{ definitions: Definition[] }>('/api/v1/admin/scheduled-jobs'),
  });
  const run = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/v1/admin/scheduled-jobs/${id}/run`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: () => {
      setSelected(null);
      return qc.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Scheduled jobs"
        description="Durable job definitions, bounded run history, and lease-safe manual enqueue."
      />
      <Alert severity="info">
        Manual run creates a durable queued request. It does not execute work in the HTTP request.
      </Alert>
      {q.isError && <RecoveryState error={q.error} onRetry={() => void q.refetch()} />}
      <CollectionSurface
        title="Scheduler definitions and recent runs"
        mode="bounded"
        busy={q.isFetching}
        empty={!q.isLoading && !q.data?.definitions.length}
      >
        <Stack spacing={2}>
          {q.data?.definitions.map((d) => (
            <div data-collection-item tabIndex={0} key={d.id}>
              <SectionCard>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="h6">{d.key}</Typography>
                    <Chip size="small" label={d.enabled ? 'Enabled' : 'Disabled'} />
                  </Stack>
                  <Typography variant="body2">
                    {humanizeCode(d.taskType)} · {d.schedule} · max {d.maxRuntimeSec}s
                  </Typography>
                  <Button
                    sx={{ alignSelf: 'flex-start' }}
                    disabled={!d.enabled || run.isPending}
                    onClick={() => setSelected(d)}
                  >
                    Queue manual run
                  </Button>
                  <Divider />
                  {d.runs.map((r) => (
                    <Typography key={r.id} variant="caption">
                      {new Date(r.createdAt).toLocaleString()} · {humanizeCode(r.status)}{' '}
                      {r.failureCode ? `· ${humanizeCode(r.failureCode)}` : ''}
                    </Typography>
                  ))}
                </Stack>
              </SectionCard>
            </div>
          ))}
        </Stack>
      </CollectionSurface>
      <GovernedActionDialog
        open={Boolean(selected)}
        title="Queue manual job run"
        effect="Create one duplicate-safe durable run request. Work executes in the owning scheduler worker, not in this browser request."
        {...(selected?.key ? { context: `${selected.key} · ${selected.schedule}` } : {})}
        {...(selected
          ? {
              preview: {
                current: `${selected.enabled ? 'Enabled' : 'Disabled'} · ${selected.schedule} · maximum runtime ${selected.maxRuntimeSec}s`,
                proposed: 'Queue one duplicate-safe manual run',
                scope: `${humanizeCode(selected.taskType)} only; the scheduler definition and recurring schedule are unchanged.`,
                timing: 'The owning worker starts work after it durably claims the queued request.',
                reversibility:
                  'The enqueue cannot be withdrawn after claim; failures remain retryable under the worker contract.',
                audit:
                  'The manual trigger, actor, durable run state, attempts, and outcome are recorded.',
              },
            }
          : {})}
        warning
        pending={run.isPending}
        {...(run.isError ? { error: run.error.message } : {})}
        onCancel={() => setSelected(null)}
        onConfirm={() => {
          if (selected) run.mutate(selected.id);
        }}
        confirmLabel="Queue durable run"
      />
    </Stack>
  );
}
