import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Alert, Button, Chip, Drawer, Stack, Typography } from '@mui/material';
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
  const query = useInfiniteQuery({
    queryKey: ['plan-library', clientId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiRequest<Library>(
        `/api/v1/consultant/clients/${clientId}/plans${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
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
        slotProps={{ paper: { sx: { width: { xs: '100%', md: 620 }, p: 3 } } }}
      >
        <Stack spacing={3}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h2">Client Plans</Typography>
            <Button onClick={() => setOpen(false)}>Close library</Button>
          </Stack>
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
              No saved Plans yet. Your first Plan starts in the workspace.
            </Alert>
          )}
          {plans.map((plan) => (
            <Stack
              key={plan.id}
              spacing={1}
              sx={{ borderBottom: 1, borderColor: 'divider', pb: 3 }}
            >
              <Typography variant="h3">{plan.versions[0]?.title ?? plan.title}</Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={plan.status.toLowerCase()} />
                {plan.versions[0] && (
                  <Chip
                    size="small"
                    label={`Version ${plan.versions[0].version} - ${plan.versions[0].status.toLowerCase()}`}
                  />
                )}
              </Stack>
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
