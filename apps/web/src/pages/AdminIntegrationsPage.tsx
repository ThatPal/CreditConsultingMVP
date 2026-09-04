import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
type Integration = {
  id: string;
  key: string;
  type: string;
  provider: string;
  enabled: boolean;
  status: string;
  configurationMetadata: unknown;
  secretConfiguration: { configured: boolean; count: number };
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCategory: string | null;
  updatedAt: string;
};
export function AdminIntegrationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => apiRequest<{ integrations: Integration[] }>('/api/v1/admin/integrations'),
  });
  const toggle = useMutation({
    mutationFn: (i: Integration) =>
      apiRequest(`/api/v1/admin/integrations/${i.id}/enabled`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          enabled: !i.enabled,
          expectedUpdatedAt: i.updatedAt,
          reason: `Governed ${i.enabled ? 'disable' : 'enable'} from Admin operations`,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-integrations'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Integration operations"
        description="Provider health and secret-presence status without exposing credential values."
      />
      <Alert severity="info">
        Payment detail and transaction operations remain in Payments. This page cannot reveal or
        replace secrets.
      </Alert>
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {q.data?.integrations.map((i) => (
            <Stack key={i.id} sx={{ py: 2, gap: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {i.provider} · {i.type}
                </Typography>
                <Chip size="small" label={i.status} />
                <Chip
                  size="small"
                  label={
                    i.secretConfiguration.configured
                      ? `${i.secretConfiguration.count} secret references configured`
                      : 'No secret reference'
                  }
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {i.key} · last success{' '}
                {i.lastSuccessAt ? new Date(i.lastSuccessAt).toLocaleString() : 'never'}{' '}
                {i.lastErrorCategory ? `· ${i.lastErrorCategory}` : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  color={i.enabled ? 'warning' : 'primary'}
                  onClick={() => {
                    if (confirm(`${i.enabled ? 'Disable' : 'Enable'} ${i.provider}?`))
                      toggle.mutate(i);
                  }}
                >
                  {i.enabled ? 'Disable' : 'Enable'}
                </Button>
                {i.type === 'PAYMENT' && (
                  <Button component={Link} to="/admin/payments">
                    Open payments
                  </Button>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
