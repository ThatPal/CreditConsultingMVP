import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { useState } from 'react';
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
  const [selected, setSelected] = useState<Integration | null>(null);
  const [reason, setReason] = useState('');
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
          reason,
        }),
      }),
    onSuccess: () => {
      setSelected(null);
      setReason('');
      return qc.invalidateQueries({ queryKey: ['admin-integrations'] });
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Integration operations"
        description="Provider health and secret-presence status without exposing credential values."
      />
      <Alert severity="info">
        Payment gateways are managed under Payments. This area is for non-payment integrations and
        never reveals secret values.
      </Alert>
      {q.isError && <RecoveryState error={q.error} onRetry={() => void q.refetch()} />}
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
                    setSelected(i);
                    setReason('');
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
      <GovernedActionDialog
        open={Boolean(selected)}
        title={`${selected?.enabled ? 'Disable' : 'Enable'} ${selected?.provider ?? 'integration'}`}
        effect={
          selected?.enabled
            ? 'New provider activity will stop. Existing audit and delivery history remains intact.'
            : 'Future eligible activity may be sent to this provider.'
        }
        {...(selected?.key ? { context: selected.key } : {})}
        reasonLabel="Reason"
        reason={reason}
        required
        warning
        pending={toggle.isPending}
        {...(toggle.isError ? { error: toggle.error.message } : {})}
        onReasonChange={setReason}
        onCancel={() => {
          setSelected(null);
          setReason('');
        }}
        onConfirm={() => {
          if (selected) toggle.mutate(selected);
        }}
      />
    </Stack>
  );
}
