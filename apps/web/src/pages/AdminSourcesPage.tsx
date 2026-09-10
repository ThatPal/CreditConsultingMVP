import { Alert, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { CollectionSurface } from '../components/common/CollectionSurface';
type Source = {
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  allowedHosts: string[];
  official: boolean;
  active: boolean;
  updatedAt: string;
  _count: { mappings: number; candidates: number };
};
const headers = () => ({
  'Content-Type': 'application/json',
  'Idempotency-Key': crypto.randomUUID(),
});
export function AdminSourcesPage() {
  const [selected, setSelected] = useState<Source | null>(null);
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-sources'],
    queryFn: () => apiRequest<{ sources: Source[] }>('/api/v1/admin/sources'),
  });
  const [key, setKey] = useState(''),
    [name, setName] = useState(''),
    [baseUrl, setBaseUrl] = useState(''),
    [host, setHost] = useState('');
  const create = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/admin/sources', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          key,
          name,
          baseUrl,
          allowedHosts: [host],
          official: false,
          reason: 'Approved retrieval source registration',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sources'] }),
  });
  const toggle = useMutation({
    mutationFn: (source: Source) =>
      apiRequest(`/api/v1/admin/sources/${source.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          active: !source.active,
          expectedUpdatedAt: source.updatedAt,
          reason,
        }),
      }),
    onSuccess: () => {
      setSelected(null);
      setReason('');
      return qc.invalidateQueries({ queryKey: ['admin-sources'] });
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Source registry"
        description="HTTPS allowlisted retrieval sources with explicit lifecycle and no credential storage."
      />
      <Alert severity="info">
        New sources are disabled until reviewed. Private-network and non-HTTPS URLs are rejected
        server-side.
      </Alert>
      {query.isError && <RecoveryState error={query.error} onRetry={() => void query.refetch()} />}
      <SectionCard>
        <Typography variant="h6">Register disabled source</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Stable key" value={key} onChange={(e) => setKey(e.target.value)} />
          <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="HTTPS base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <TextField
            label="Allowed hostname"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <Button
            disabled={!key || !name || !baseUrl || !host || create.isPending}
            onClick={() => create.mutate()}
          >
            Register source
          </Button>
        </Stack>
      </SectionCard>
      <CollectionSurface
        title="Reviewed source registry"
        mode="bounded"
        busy={query.isFetching}
        empty={!query.isLoading && !query.data?.sources.length}
      >
        <Stack divider={<Divider flexItem />}>
          {query.data?.sources.map((source) => (
            <Stack data-collection-item tabIndex={0} key={source.id} sx={{ py: 2, gap: 1 }}>
              <Stack direction="row" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{source.name}</Typography>
                <Chip size="small" label={source.active ? 'Active' : 'Disabled'} />
                {source.official && <Chip size="small" label="Official" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {source.baseUrl} · allowlist {source.allowedHosts.join(', ')} ·{' '}
                {source._count.candidates} candidates
              </Typography>
              <Button
                sx={{ alignSelf: 'flex-start' }}
                color={source.active ? 'warning' : 'primary'}
                onClick={() => setSelected(source)}
              >
                {source.active ? 'Disable' : 'Enable'}
              </Button>
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
      <GovernedActionDialog
        open={Boolean(selected)}
        title={`${selected?.active ? 'Disable' : 'Enable'} retrieval source`}
        effect={
          selected?.active
            ? 'New retrieval through this allowlisted source will stop. Existing provenance remains immutable.'
            : 'Future retrieval may use this HTTPS source only within its reviewed host allowlist.'
        }
        {...(selected?.name ? { context: selected.name } : {})}
        {...(selected
          ? {
              preview: {
                current: `${selected.active ? 'Effective' : 'Disabled'} · ${selected.baseUrl}`,
                proposed: selected.active
                  ? 'Disable new retrieval'
                  : 'Enable allowlisted retrieval',
                scope: `Only ${selected.name}; ${selected._count.mappings} mappings and ${selected._count.candidates} historical candidates retain provenance.`,
                timing:
                  'Applies to future retrieval after the version-safe update; in-flight work is unchanged.',
                reversibility: 'A later reviewed version may restore the prior enabled state.',
                audit: 'Actor, reason, allowlist, prior state, and resulting state are recorded.',
              },
            }
          : {})}
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
        confirmLabel={selected?.active ? 'Disable source' : 'Enable source'}
      />
    </Stack>
  );
}
