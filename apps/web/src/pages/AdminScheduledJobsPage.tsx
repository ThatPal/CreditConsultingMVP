import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { humanizeCode } from '../components/common/labels';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
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
      {q.data?.definitions.map((d) => (
        <SectionCard key={d.id}>
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
      ))}
      <GovernedActionDialog
        open={Boolean(selected)}
        title="Queue manual job run"
        effect="Create one duplicate-safe durable run request. Work executes in the owning scheduler worker, not in this browser request."
        {...(selected?.key ? { context: `${selected.key} · ${selected.schedule}` } : {})}
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
