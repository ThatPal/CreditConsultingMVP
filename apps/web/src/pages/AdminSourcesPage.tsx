import { Alert, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
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
          reason: `${source.active ? 'Disable' : 'Enable'} governed retrieval source`,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sources'] }),
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
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {query.data?.sources.map((source) => (
            <Stack key={source.id} sx={{ py: 2, gap: 1 }}>
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
                onClick={() => {
                  if (confirm(`${source.active ? 'Disable' : 'Enable'} ${source.name}?`))
                    toggle.mutate(source);
                }}
              >
                {source.active ? 'Disable' : 'Enable'}
              </Button>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
