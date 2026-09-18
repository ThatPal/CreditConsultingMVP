import { Box, Button, Stack, Typography } from '@mui/material';
import { portalSurfaces } from '../../theme/portalSurfaces';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import { creditWorkspaceKeys, creditWorkspaceRefetchInterval } from '../../queries/creditWorkspace';
import {
  CreditCenterNavigation,
  creditCenterAreas,
  creditCenterPath,
  type CreditCenterArea,
} from './CreditCenterNavigation';
import { formatReportDate } from './data';

type ReviewContext = {
  id: string;
  reviewId: string;
  publishedAt: string;
  report: null | { reportDate: string | null };
};
export type CreditCenterContextRead = { current: ReviewContext | null; history: ReviewContext[] };

/** Current-only until assessment-scoped composition exists. No disabled destinations. */
export function CreditCenterHeader({
  area,
  data,
  pending = false,
}: {
  area: CreditCenterArea;
  data?: CreditCenterContextRead | undefined;
  pending?: boolean;
}) {
  const [search] = useSearchParams();
  const location = useLocation();
  const requested = search.get('review');
  const current = data?.current;
  const unavailable = Boolean(requested && requested !== current?.id);
  const historical = unavailable ? data?.history.find((r) => r.id === requested) : undefined;
  const currentSearch = new URLSearchParams(search);
  currentSearch.delete('review');
  const label = historical
    ? 'Historical Review'
    : unavailable
      ? 'Assessment unavailable'
      : current
        ? 'Current Review'
        : pending
          ? 'Loading assessment'
          : data
            ? 'No published assessment'
            : 'Assessment unavailable';
  return (
    <Box component="header" aria-label="Credit Center shell" sx={{ mb: 3 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', lg: 'center' },
          gap: { xs: 1.5, lg: 3 },
          px: { xs: 0, lg: 2.5 },
          py: { xs: 0, lg: 2 },
          border: { xs: 'none', lg: `1px solid ${portalSurfaces.border}` },
          borderRadius: '12px',
          background: {
            xs: 'none',
            lg: `radial-gradient(ellipse at 0% 0%, rgba(102,216,189,.07), transparent 65%), ${portalSurfaces.panel}`,
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 24, lg: 28 }, letterSpacing: '-.03em' }}>
            Credit Center
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, fontSize: 14 }}>
            Your credit profile, analysis, and strategy — all in one place.
          </Typography>
        </Box>
        <Box
          aria-label={'Viewing ' + label}
          sx={{
            flexShrink: 0,
            width: { xs: '100%', lg: 'auto' },
            px: 1.75,
            py: 1,
            minWidth: { lg: 180 },
            border: `1px solid ${portalSurfaces.border}`,
            borderRadius: '8px',
            background: portalSurfaces.panel,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {label}
          </Typography>
          {current && !unavailable && (
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {new Date(current.publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </Typography>
          )}
        </Box>
      </Stack>
      {unavailable && (
        <Stack
          component="section"
          aria-label="Historical review context"
          direction={{ xs: 'column', lg: 'row' }}
          sx={{
            mt: 2,
            px: 2,
            py: 1,
            gap: 1,
            alignItems: { lg: 'center' },
            justifyContent: 'space-between',
            borderLeft: 2,
            borderColor: 'warning.main',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 600 }}>
              {historical
                ? 'Historical view · ' + formatReportDate(historical.publishedAt)
                : 'Requested assessment unavailable'}
            </Box>
            {historical && ' — This may no longer reflect your current credit situation.'}
          </Typography>
          <Button
            component={Link}
            to={{ pathname: location.pathname, search: currentSearch.toString() }}
            size="small"
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', lg: 'center' } }}
          >
            Return to current
          </Button>
        </Stack>
      )}
      <Box sx={{ mt: { xs: 1.5, lg: 1 } }}>
        <CreditCenterNavigation area={area} />
      </Box>
    </Box>
  );
}

export function CreditCenterShell() {
  const location = useLocation();
  const [search] = useSearchParams();
  const area =
    creditCenterAreas.find((a) => creditCenterPath(a.id) === location.pathname)?.id ??
    (location.pathname === '/app/plan' ? 'plan' : 'overview');
  const query = useQuery({
    queryKey: creditWorkspaceKeys.creditCenter(),
    queryFn: () => apiRequest<CreditCenterContextRead>('/api/v1/client/credit-profile'),
    refetchInterval: creditWorkspaceRefetchInterval,
    retry: false,
  });
  const requested = search.get('review');
  // Do not render current workspace actions underneath a historical/unknown context.
  const unavailable = Boolean(requested && requested !== query.data?.current?.id);
  return (
    <>
      <CreditCenterHeader
        area={area}
        data={query.isError ? undefined : query.data}
        pending={query.isPending}
      />
      {unavailable ? (
        <Typography color="text.secondary">
          A complete Credit Center for this assessment is not available. View its published snapshot
          in <Link to={creditCenterPath('history')}>History</Link>, or return to the current
          assessment.
        </Typography>
      ) : (
        <Outlet />
      )}
    </>
  );
}
