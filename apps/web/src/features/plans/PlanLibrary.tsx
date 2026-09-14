import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../auth/api';

type Plan = {
  id: string;
  title: string;
  status: string;
  purpose: string;
  updatedAt: string;
  versions: { title: string | null; version: number; status: string }[];
};
const lifecycleLabels: Record<string, string> = {
  DRAFT: 'Private draft',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  STALE: 'Needs source review',
  SUPERSEDED: 'Replaced',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const lifecycleCopy: Record<string, string> = {
  DRAFT: 'Private work; not yet published to the client.',
  APPROVED: 'Approved Plan. Open it to inspect its publication context.',
  ACTIVE: 'Active Plan. Open it to check the current client publication.',
  STALE: 'Source review is needed before this Plan can move forward.',
  SUPERSEDED: 'Retained for history after replacement.',
  COMPLETED: 'Completed work retained for reference.',
  CANCELLED: 'Closed without publication; retained for history.',
};
type Library = { plans: Plan[]; nextBefore: string | null };
export function PlanLibrary({
  clientId,
  selectedId,
}: {
  clientId: string;
  selectedId?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [search] = useSearchParams();
  const [titleSearch, setTitleSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(titleSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [titleSearch]);
  const query = useInfiniteQuery({
    queryKey: ['plan-library', clientId, term, status],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('before', pageParam);
      if (term) params.set('search', term);
      if (status) params.set('status', status);
      return apiRequest<Library>(
        `/api/v1/consultant/clients/${clientId}/plans${params.size ? `?${params}` : ''}`,
      );
    },
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: open,
    retry: false,
  });
  const destination = (id?: string) => {
    const next = new URLSearchParams(search);
    if (id) next.set('planId', id);
    else next.delete('planId');
    return `?${next.toString()}`;
  };
  const plans = query.data?.pages.flatMap((page) => page.plans) ?? [];
  return (
    <>
      <Button sx={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        Browse client Plans
      </Button>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', md: 620 } } } }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            bgcolor: 'background.paper',
            p: 3,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h2">Client Plans</Typography>
            <Button onClick={() => setOpen(false)}>Close library</Button>
          </Stack>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              size="small"
              label="Search Plan titles"
              value={titleSearch}
              onChange={(event) => setTitleSearch(event.target.value)}
              helperText="Includes earlier saved titles."
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField
              select
              size="small"
              label="Plan status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <MenuItem value="">All statuses</MenuItem>
              {Object.entries(lifecycleLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            {(titleSearch || status) && (
              <Button
                onClick={() => {
                  setTitleSearch('');
                  setTerm('');
                  setStatus('');
                }}
              >
                Clear search and status
              </Button>
            )}
          </Stack>
        </Box>
        <Stack spacing={3} sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Resume a saved Plan or inspect a closed Plan's history. Opening a Plan does not publish
            it or change the client's instructions.
          </Typography>
          <Button component={Link} to={destination()} onClick={() => setOpen(false)}>
            Open most recently updated Plan
          </Button>
          <Button
            component={Link}
            to={destination('new')}
            onClick={() => setOpen(false)}
            variant="contained"
          >
            Start a separate Plan
          </Button>
          {query.isPending && <Typography role="status">Loading Plans...</Typography>}
          {query.isError && (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() =>
                    void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                  }
                >
                  Retry Plans
                </Button>
              }
            >
              Could not load Plans. Any Plans already loaded remain available.
            </Alert>
          )}
          {!query.isPending && !query.isError && !plans.length && (
            <Alert severity="info">
              {term || status
                ? 'No Plans match this search and status. Try another title or clear the filters.'
                : 'No saved Plans yet. Your first Plan starts in the workspace.'}
            </Alert>
          )}
          {plans.map((plan) => (
            <Stack
              key={plan.id}
              spacing={1}
              sx={{ borderBottom: 1, borderColor: 'divider', pb: 3 }}
            >
              <Typography variant="h3">{plan.versions[0]?.title ?? plan.title}</Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={lifecycleLabels[plan.status] ?? plan.status} />
                {plan.versions[0] && (
                  <Chip
                    size="small"
                    label={`Version ${plan.versions[0].version} - ${plan.versions[0].status.toLowerCase()}`}
                  />
                )}
              </Stack>
              <Typography variant="body2">{lifecycleCopy[plan.status]}</Typography>
              <Typography variant="body2" color="text.secondary">
                Updated {new Date(plan.updatedAt).toLocaleString()}
              </Typography>
              <Button
                component={Link}
                to={destination(plan.id)}
                onClick={() => setOpen(false)}
                sx={{ alignSelf: 'flex-start' }}
                aria-current={selectedId === plan.id ? 'page' : undefined}
              >
                {selectedId === plan.id
                  ? 'Return to selected Plan'
                  : ['CANCELLED', 'SUPERSEDED'].includes(plan.status)
                    ? 'Inspect Plan history'
                    : 'Open Plan'}
              </Button>
            </Stack>
          ))}
          {query.hasNextPage && (
            <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {query.isFetchingNextPage ? 'Loading more...' : 'Load more Plans'}
            </Button>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
