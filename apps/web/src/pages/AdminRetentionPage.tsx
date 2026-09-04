import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../auth/api';
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['retention'] }),
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
              <Button
                color="warning"
                disabled={!p.enabled}
                onClick={() => {
                  if (confirm('Permanently remove only the previewed class of expired sessions?'))
                    act.mutate({ id: p.id, mode: 'execute' });
                }}
              >
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
    </Stack>
  );
}
