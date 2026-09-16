import { formatReportDate } from './data';
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { apiRequest } from '../../auth/api';
import {
  creditWorkspaceKeys,
  creditWorkspaceRefetchInterval,
  type CreditWorkspaceRead,
} from '../../queries/creditWorkspace';
import { adaptPublishedProfile } from './data';
type SnapshotRead = {
  workspace?: CreditWorkspaceRead;
  current: null | {
    publishedAt: string;
    projection: { profile?: Record<string, unknown>; analysisSummary?: string };
    report: null | { reportDate: string | null };
  };
};
export function HomeCreditSnapshot() {
  const query = useQuery({
    queryKey: creditWorkspaceKeys.creditCenter(),
    queryFn: () => apiRequest<SnapshotRead>('/api/v1/client/credit-profile'),
    refetchInterval: creditWorkspaceRefetchInterval,
    retry: false,
  });
  if (query.isPending)
    return (
      <Typography variant="body2" color="text.secondary">
        Loading published credit snapshot…
      </Typography>
    );
  if (query.isError)
    return (
      <Typography variant="body2" color="text.secondary">
        The credit snapshot could not be loaded. Open Credit Center to retry.
      </Typography>
    );
  const current = query.data?.current;
  if (!current) return null;
  const data = adaptPublishedProfile(
    current.projection.profile ?? {},
    current.report?.reportDate ?? null,
  );
  const score = data.scores.find((s) => s.value !== null);
  const utilization = data.metrics.aggregateUtilization;
  return (
    <Stack spacing={2} sx={{ my: 2 }}>
      <Stack direction="row" spacing={4}>
        <Box>
          <Typography variant="caption">{score?.bureau ?? 'Credit score'}</Typography>
          <Typography sx={{ fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>
            {score?.value ?? 'Not available'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Scoring model not supplied
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption">Published utilization</Typography>
          <Typography sx={{ fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>
            {utilization?.value != null ? utilization.value + '%' : 'Not available'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Account coverage not supplied
          </Typography>
        </Box>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {current.report?.reportDate
          ? 'Report dated ' + formatReportDate(current.report.reportDate)
          : 'Report date unavailable'}{' '}
        · Published {new Date(current.publishedAt).toLocaleDateString()}
      </Typography>
      {current.projection.analysisSummary && (
        <Typography sx={{ maxWidth: 800 }}>{current.projection.analysisSummary}</Typography>
      )}
    </Stack>
  );
}
