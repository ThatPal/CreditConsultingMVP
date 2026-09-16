import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import {
  creditWorkspaceKeys,
  creditWorkspaceRefetchInterval,
  type CreditWorkspaceRead,
} from '../../queries/creditWorkspace';
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
export type CreditCenterContextRead = {
  current: ReviewContext | null;
  history: ReviewContext[];
  workspace?: CreditWorkspaceRead;
};

const reviewLabel = (review: ReviewContext) => formatReportDate(review.publishedAt);
function currentness(profile: CreditWorkspaceRead['profile'] | undefined) {
  if (profile?.status === 'REVIEW_IN_PROGRESS') return 'Review in progress';
  if (profile?.isCurrent === true) return 'Current';
  if (profile?.reason === 'NO_PUBLICATION' || profile?.status === 'NOT_AVAILABLE')
    return 'No published Profile';
  if (profile?.isCurrent === false) return 'Refresh recommended';
  return 'Currentness unavailable';
}

/** Read-only shell. Historical publications do not imply an assessment-scoped Plan. */
export function CreditCenterHeader({
  area,
  data,
  pending = false,
}: {
  area: CreditCenterArea;
  data?: CreditCenterContextRead | undefined;
  pending?: boolean;
}) {
  const narrow = useMediaQuery(useTheme().breakpoints.down('lg'));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search] = useSearchParams();
  const location = useLocation();
  const requested = search.get('review');
  const current = data?.current;
  const previous = (data?.history ?? [])
    .filter((r) => r.reviewId !== current?.reviewId)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((r, index, rows) => rows.findIndex((other) => other.reviewId === r.reviewId) === index);
  const historical = previous.find((r) => r.id === requested);
  const unavailable = Boolean(requested && requested !== current?.id);
  const selected = unavailable ? historical : current;
  const currentSearch = new URLSearchParams(search);
  currentSearch.delete('review');
  const currentHref = { pathname: location.pathname, search: currentSearch.toString() };
  const label = historical
    ? `Historical · ${reviewLabel(historical)}`
    : unavailable
      ? 'Assessment unavailable'
      : current
        ? `Current · ${reviewLabel(current)}`
        : pending
          ? 'Loading assessment'
          : data
            ? 'No published assessment'
            : 'Assessment unavailable';
  const rows = (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block' }}>
        Current
      </Typography>
      {current && (
        <MenuItem
          component={Link}
          to={currentHref}
          selected={!unavailable}
          onClick={() => setAnchor(null)}
          sx={{ gap: 2, minHeight: 48 }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography>{reviewLabel(current)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Current assessment
            </Typography>
          </Box>
          {!unavailable && <CheckRounded fontSize="small" aria-label="Selected review" />}
        </MenuItem>
      )}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 2, mt: 1.5, display: 'block' }}
      >
        Previous reviews
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', px: 2, pb: 1, maxWidth: 360 }}
      >
        Full historical Credit Center views are not yet available. Published snapshots remain in
        History.
      </Typography>
      {previous.map((r) => (
        <MenuItem
          key={r.id}
          disabled
          sx={{ whiteSpace: 'normal', minHeight: 60, '&.Mui-disabled': { opacity: 0.7 } }}
        >
          <Box>
            <Typography>{reviewLabel(r)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Report{' '}
              {r.report?.reportDate ? formatReportDate(r.report.reportDate) : 'date unavailable'} ·
              Snapshot only
            </Typography>
          </Box>
        </MenuItem>
      ))}
      <MenuItem
        component={Link}
        to={creditCenterPath('history')}
        onClick={() => setAnchor(null)}
        sx={{ borderTop: 1, borderColor: 'divider', mt: 1, minHeight: 48 }}
      >
        View full history
      </MenuItem>
    </>
  );
  return (
    <Box component="header" aria-label="Credit Center shell" sx={{ mb: { xs: 3, lg: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr auto', lg: 'minmax(0, 1fr) auto' },
          columnGap: 2,
          alignItems: 'start',
        }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ gridColumn: 1, fontSize: 11, lineHeight: '28px' }}
        >
          Credit Center
        </Typography>
        <Box sx={{ gridColumn: 2, gridRow: { xs: 1, lg: '1 / 4' }, alignSelf: { lg: 'center' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', lg: 'block' }, mb: 0.5 }}
          >
            VIEWING
          </Typography>
          {previous.length ? (
            <Button
              aria-label={`Viewing ${label}`}
              aria-haspopup={narrow ? 'dialog' : 'menu'}
              aria-expanded={Boolean(anchor)}
              onClick={(e) => setAnchor(e.currentTarget)}
              endIcon={<ExpandMoreRounded />}
              sx={{
                py: { xs: 0, lg: 0.75 },
                minHeight: { xs: 28, lg: 40 },
                px: 1,
                color: 'text.primary',
                border: { lg: 1 },
                borderColor: 'divider',
                borderRadius: 1,
                fontSize: 14,
              }}
            >
              {narrow
                ? historical
                  ? 'Historical'
                  : unavailable
                    ? 'Unavailable'
                    : 'Current'
                : label}
            </Button>
          ) : (
            <Typography
              aria-label={`Viewing ${label}`}
              sx={{ fontSize: { xs: 12, lg: 14 }, lineHeight: '28px', color: 'text.secondary' }}
            >
              {label}
            </Typography>
          )}
        </Box>
        <Typography
          variant="h1"
          sx={{
            gridColumn: { xs: '1 / -1', lg: 1 },
            fontSize: { xs: 28, lg: 34 },
            lineHeight: 1.2,
          }}
        >
          Credit Center
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            gridColumn: { xs: '1 / -1', lg: 1 },
            mt: 0.75,
            maxWidth: 720,
            fontSize: { xs: 15, lg: 16 },
            lineHeight: 1.4,
          }}
        >
          {narrow
            ? 'Your credit picture, consultant’s analysis, and next steps.'
            : 'Understand your credit picture, your consultant’s analysis, and what to do next.'}
        </Typography>
      </Box>
      <Typography
        color="text.secondary"
        sx={{ mt: { xs: 1.5, lg: 2 }, fontSize: { xs: 12, lg: 13 }, lineHeight: 1.5 }}
      >
        {selected ? (
          <>
            Based on report{' '}
            {selected.report?.reportDate
              ? formatReportDate(selected.report.reportDate)
              : 'date unavailable'}
            {' · '}Profile published {reviewLabel(selected)}
            {' · '}
            {historical ? 'Historical publication' : currentness(data?.workspace?.profile)}
          </>
        ) : pending ? (
          'Loading report and publication context…'
        ) : (
          'Report and publication context unavailable'
        )}
      </Typography>
      {unavailable && (
        <Box
          component="section"
          aria-label="Historical review context"
          sx={{
            mt: 2,
            py: 1.5,
            px: 2,
            borderLeft: 2,
            borderColor: 'warning.main',
            bgcolor: 'action.hover',
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
            {historical
              ? `Historical view · ${reviewLabel(historical)}`
              : 'Requested assessment unavailable'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {narrow
              ? 'This may no longer reflect your current credit situation.'
              : `You’re viewing ${historical ? 'your credit assessment from ' + reviewLabel(historical) : 'an unavailable assessment'}. Information and recommendations here may no longer reflect your current credit situation.`}
          </Typography>
          <Button component={Link} to={currentHref} size="small" sx={{ mt: 0.5 }}>
            Return to current
          </Button>
        </Box>
      )}
      <Box sx={{ mt: { xs: 2, lg: 2.5 } }}>
        <CreditCenterNavigation area={area} />
      </Box>
      {narrow ? (
        <Dialog
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          aria-labelledby="review-context-title"
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                position: 'fixed',
                bottom: 0,
                m: 0,
                width: '100%',
                maxHeight: '85dvh',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                backgroundImage: 'none',
              },
            },
          }}
        >
          <DialogTitle id="review-context-heading" sx={{ pr: 7 }}>
            <span id="review-context-title">Viewing assessment</span>
            <IconButton
              aria-label="Close review selector"
              onClick={() => setAnchor(null)}
              sx={{ position: 'absolute', right: 12, top: 12 }}
            >
              <CloseRounded />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 0 }}>{rows}</DialogContent>
        </Dialog>
      ) : (
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          slotProps={{
            paper: { sx: { maxHeight: 420, maxWidth: 380, backgroundImage: 'none' } },
            list: { 'aria-label': 'Review context' },
          }}
        >
          {rows}
        </Menu>
      )}
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
