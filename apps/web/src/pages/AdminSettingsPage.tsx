import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
type Setting = {
  id: string;
  key: string;
  version: number;
  value: boolean;
  active: boolean;
  reason: string;
  createdAt: string;
};
const keys = [
  'commerce.purchases.enabled',
  'ai.processing.enabled',
  'notifications.email.enabled',
  'workflow.execution.enabled',
];
export function AdminSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest<{ settings: Setting[] }>('/api/v1/admin/settings'),
  });
  const change = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      apiRequest(`/api/v1/admin/settings/${key}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          value,
          activate: true,
          reason: `Governed safety switch changed to ${value}`,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Platform settings & safety switches"
        description="Typed, versioned controls with narrow fail-safe effects."
      />
      <Alert severity="warning">
        Disabling a switch blocks new work only. It never bypasses authorization, changes historical
        records, or silently cancels in-flight durable work.
      </Alert>
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {keys.map((key) => {
            const current = q.data?.settings.find((s) => s.key === key && s.active);
            const enabled = current?.value !== false;
            return (
              <Stack key={key} sx={{ py: 2, gap: 1 }}>
                <Stack direction="row" spacing={1}>
                  <Typography sx={{ fontWeight: 700 }}>{key}</Typography>
                  <Chip size="small" label={enabled ? 'Enabled' : 'Disabled'} />
                </Stack>
                <Button
                  sx={{ alignSelf: 'flex-start' }}
                  color={enabled ? 'warning' : 'primary'}
                  onClick={() => {
                    if (confirm(`${enabled ? 'Disable' : 'Enable'} ${key}?`))
                      change.mutate({ key, value: !enabled });
                  }}
                >
                  {enabled ? 'Disable new operations' : 'Enable'}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
