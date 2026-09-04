import { Alert, Box, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
export function AdminReportsPage() {
  const to = new Date(),
    from = new Date(Date.now() - 30 * 86400000);
  const q = useQuery({
    queryKey: ['operations-report'],
    queryFn: () =>
      apiRequest<{ sections: Record<string, Array<Record<string, unknown>>> }>(
        `/api/v1/admin/reports/operations-summary?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Operational reports"
        description="Approved aggregate metrics from canonical records; no arbitrary query or hidden export surface."
      />
      <Alert severity="info">
        Showing the last 30 days. Counts are operational indicators, not professional
        recommendations.
      </Alert>
      {Object.entries(q.data?.sections ?? {}).map(([name, rows]) => (
        <SectionCard key={name}>
          <Typography variant="h6">{name}</Typography>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(rows, null, 2)}
          </Box>
        </SectionCard>
      ))}
    </Stack>
  );
}
