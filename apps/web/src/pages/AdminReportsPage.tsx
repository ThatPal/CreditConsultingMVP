import { Alert, Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { humanizeAdminLabel, SafeRecordView } from '../components/admin/SafeRecordView';
import { CollectionSurface } from '../components/common/CollectionSurface';
import { ArchetypeCanvas, FreshnessIndicator, MetricHero } from '../components/common/ProductFoundation';
export function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const to = new Date();
  const from = new Date(Date.now() - days * 86400000);
  const q = useQuery({
    queryKey: ['operations-report', days],
    queryFn: () =>
      apiRequest<{ sections: Record<string, Array<Record<string, unknown>>> }>(
        `/api/v1/admin/reports/operations-summary?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
  });
  const sections = q.data?.sections ?? {};
  const total = (rows: Array<Record<string, unknown>>) =>
    rows.reduce((sum, row) => sum + Number(row._count ?? row.count ?? 0), 0);
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Operational reports"
        description="Approved aggregate metrics from canonical records; no arbitrary query or hidden export surface."
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Reporting period"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value={7}>Last 7 days</MenuItem>
          <MenuItem value={30}>Last 30 days</MenuItem>
          <MenuItem value={90}>Last 90 days</MenuItem>
        </TextField>
        <Alert severity="info" sx={{ flex: 1 }}>
          Canonical aggregate records from {from.toLocaleDateString()} through{' '}
          {to.toLocaleDateString()}. These are operational indicators, not professional
          recommendations.
        </Alert>
      </Stack>
      {q.isError && <RecoveryState error={q.error} onRetry={() => void q.refetch()} />}
      {!q.isLoading && !q.isError && !Object.keys(sections).length && (
        <Alert severity="info">No operational report data is available for this period.</Alert>
      )}
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        {Object.entries(sections).map(([name, rows]) => (
          <MetricCard
            key={name}
            label={humanizeAdminLabel(name)}
            value={total(rows)}
            supportingText={`${rows.length} status groups`}
          />
        ))}
      </Box>
      <ArchetypeCanvas archetype="operations-grid" role="admin">
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 3, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}><MetricHero label="Operational record groups" value={Object.values(sections).reduce((sum, rows) => sum + rows.length, 0)} explanation="Aggregated status groups in the selected reporting period." source="Canonical operational report endpoint" /></Box>
          <Stack spacing={1}><FreshnessIndicator state={q.isError ? 'stale' : 'confirmed'} at={q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : undefined} /><Typography color="text.secondary">Changing the period refreshes read-only aggregates. It does not mutate operational records.</Typography></Stack>
        </Stack>
      </ArchetypeCanvas>
      {Object.entries(sections).map(([name, rows]) => (
        <CollectionSurface key={name} title={humanizeAdminLabel(name)} mode="grid" empty={!rows.length} maxHeight={420}>
        <SectionCard>
          <Stack spacing={2}>
            <Typography variant="h3">{humanizeAdminLabel(name)}</Typography>
            {!rows.length ? (
              <Typography color="text.secondary">No records in this period.</Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 2,
                }}
              >
                {rows.map((row, index) => (
                  <Box
                    key={`${name}-${index}`}
                    sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <SafeRecordView record={row} />
                  </Box>
                ))}
              </Box>
            )}
          </Stack>
        </SectionCard>
        </CollectionSurface>
      ))}
    </Stack>
  );
}
