import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
type Policy = {
  id: string;
  key: string;
  target: string;
  retainDays: number;
  enabled: boolean;
  runs: Array<{
    id: string;
    mode: string;
    status: string;
    affectedCount: number;
    createdAt: string;
  }>;
};
export function AdminRetentionPage() {
  const [executePolicy, setExecutePolicy] = useState<Policy | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['retention'],
    queryFn: () => apiRequest<{ policies: Policy[] }>('/api/v1/admin/retention'),
  });
  const act = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: 'preview' | 'execute' }) =>
      apiRequest(`/api/v1/admin/retention/${id}/${mode}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: () => {
      setExecutePolicy(null);
      return qc.invalidateQueries({ queryKey: ['retention'] });
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Retention operations"
        description="Preview-first, allowlisted cleanup. Audit and security history are permanently excluded."
      />
      <Alert severity="warning">
        Execution is disabled by default and limited to expired sessions. Preview before executing.
      </Alert>
      {q.isError && <RecoveryState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data?.policies.map((p) => (
        <SectionCard key={p.id}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Typography variant="h6">{p.key}</Typography>
              <Chip size="small" label={p.enabled ? 'Enabled' : 'Disabled'} />
            </Stack>
            <Typography>
              {p.target} · retain {p.retainDays} days
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => act.mutate({ id: p.id, mode: 'preview' })}>Preview</Button>
              <Button color="warning" disabled={!p.enabled} onClick={() => setExecutePolicy(p)}>
                Execute
              </Button>
            </Stack>
            <Divider />
            {p.runs.map((r) => (
              <Typography key={r.id} variant="caption">
                {r.mode} · {r.affectedCount} records · {new Date(r.createdAt).toLocaleString()}
              </Typography>
            ))}
          </Stack>
        </SectionCard>
      ))}
      <GovernedActionDialog
        open={Boolean(executePolicy)}
        title="Execute retention policy"
        effect={`Permanently remove eligible ${executePolicy?.target ?? 'records'} older than ${executePolicy?.retainDays ?? 'the configured'} days. Immutable audit, security, professional and payment history remain excluded.`}
        {...(executePolicy?.key ? { context: executePolicy.key } : {})}
        warning
        pending={act.isPending}
        {...(act.isError ? { error: act.error.message } : {})}
        onCancel={() => setExecutePolicy(null)}
        onConfirm={() => {
          if (executePolicy) act.mutate({ id: executePolicy.id, mode: 'execute' });
        }}
        confirmLabel="Execute reviewed retention"
      />
    </Stack>
  );
}
