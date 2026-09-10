import { Alert, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { PageHeader } from '../components/common/PageHeader';
import { CollectionSurface } from '../components/common/CollectionSurface';
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
  const [selected, setSelected] = useState<{ key: string; enabled: boolean } | null>(null);
  const [reason, setReason] = useState('');
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
          reason,
        }),
      }),
    onSuccess: () => {
      setSelected(null);
      setReason('');
      return qc.invalidateQueries({ queryKey: ['settings'] });
    },
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
      {q.isError && <RecoveryState error={q.error} onRetry={() => void q.refetch()} />}
      <CollectionSurface
        title="Effective capability configuration"
        mode="bounded"
        busy={q.isFetching}
        empty={false}
      >
        <Stack divider={<Divider flexItem />}>
          {keys.map((key) => {
            const current = q.data?.settings.find((s) => s.key === key && s.active);
            const enabled = current?.value !== false;
            return (
              <Stack data-collection-item tabIndex={0} key={key} sx={{ py: 2, gap: 1 }}>
                <Stack direction="row" spacing={1}>
                  <Typography sx={{ fontWeight: 700 }}>{key}</Typography>
                  <Chip size="small" label={enabled ? 'Enabled' : 'Disabled'} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {current
                    ? `Effective version ${current.version} · ${current.reason} · activated ${new Date(current.createdAt).toLocaleString()}`
                    : 'Using the safe platform default; no active override is recorded.'}
                </Typography>
                <Button
                  sx={{ alignSelf: 'flex-start' }}
                  color={enabled ? 'warning' : 'primary'}
                  onClick={() => setSelected({ key, enabled })}
                >
                  {enabled ? 'Disable new operations' : 'Enable'}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </CollectionSurface>
      <GovernedActionDialog
        open={Boolean(selected)}
        title={`${selected?.enabled ? 'Disable' : 'Enable'} platform capability`}
        effect={
          selected?.enabled
            ? 'New operations in this domain will stop. Durable history and in-flight work remain governed by their owning services.'
            : 'New eligible operations in this domain may resume after the versioned setting is activated.'
        }
        {...(selected?.key ? { context: selected.key } : {})}
        {...(selected
          ? {
              preview: {
                current: selected.enabled
                  ? 'Configured and effective: enabled'
                  : 'Configured and effective: disabled',
                proposed: selected.enabled
                  ? 'Disable creation of new operations'
                  : 'Enable creation of new eligible operations',
                scope: `${selected.key}; no other capability or historical record changes.`,
                timing:
                  'Effective for newly requested work after activation; queued and running work retain their recorded contract.',
                reversibility:
                  'A later version may restore the prior value. Historical versions remain immutable.',
                audit: 'The version, actor, reason, prior value, and effective value are recorded.',
              },
            }
          : {})}
        reasonLabel="Reason for this change"
        reason={reason}
        required
        warning
        pending={change.isPending}
        {...(change.isError ? { error: change.error.message } : {})}
        onReasonChange={setReason}
        onCancel={() => {
          setSelected(null);
          setReason('');
        }}
        onConfirm={() => {
          if (selected) change.mutate({ key: selected.key, value: !selected.enabled });
        }}
        confirmLabel={selected?.enabled ? 'Disable new operations' : 'Enable capability'}
      />
    </Stack>
  );
}
