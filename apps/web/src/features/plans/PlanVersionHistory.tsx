import { PlanDraftComparison } from './PlanDraftComparison';
import { useEffect, useId, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Divider, Drawer, Stack, Typography } from '@mui/material';
import { apiRequest } from '../../auth/api';
import { draftFromBuilder, type BuilderResponse, type PlanDraft } from './editor';
import { PlanLifecyclePreview } from './PlanLifecyclePreview';
type Version = NonNullable<BuilderResponse['plan']>['versions'][number] & {
  createdAt: string;
  approvedAt: string | null;
};
type History = {
  versions: Version[];
  nextBefore: number | null;
  cancellation?: { at: string; reason: string } | null;
};
export function PlanVersionHistory({
  clientId,
  planId,
  workingDraft,
}: {
  clientId: string;
  planId: string;
  workingDraft: PlanDraft;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const detailsRef = useRef<HTMLDivElement>(null);
  const inspectTrigger = useRef<HTMLButtonElement | null>(null);
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Version | null>(null);
  useEffect(() => {
    if (open && selected) detailsRef.current?.focus();
  }, [open, selected]);
  const query = useInfiniteQuery({
    queryKey: ['plan-version-history', clientId, planId],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      apiRequest<History>(
        `/api/v1/consultant/clients/${clientId}/plans/${planId}/history${pageParam ? `?before=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const versions = query.data?.pages.flatMap((page) => page.versions) ?? [];
  return (
    <>
      <Button sx={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        Version history
      </Button>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            sx: { width: { xs: '100%', md: 760 } },
          },
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            flexShrink: 0,
            zIndex: 1,
            bgcolor: 'background.paper',
            p: 3,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
          >
            <Typography id={titleId} variant="h2">
              Plan version history
            </Typography>
            <Button onClick={() => setOpen(false)}>Close history</Button>
          </Stack>
        </Box>
        <Stack spacing={2} sx={{ p: 3 }}>
          <Alert severity="info">
            Inspect saved versions without replacing your working copy. Recorded progress belongs to
            each version. Historical snapshots are not current client instructions.
          </Alert>
          {query.data?.pages[0]?.cancellation && (
            <Alert severity="info">
              Cancelled {new Date(query.data.pages[0].cancellation.at).toLocaleString()}:{' '}
              {query.data.pages[0].cancellation.reason}
            </Alert>
          )}
          {query.isPending && <Typography role="status">Loading versions...</Typography>}
          {query.isError && (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() =>
                    void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                  }
                >
                  Retry history
                </Button>
              }
            >
              Versions could not be loaded. Previously loaded versions remain available.
            </Alert>
          )}
          {!query.isPending && !query.isError && !versions.length && (
            <Typography>No saved versions found.</Typography>
          )}
          <Stack spacing={2} divider={<Divider />}>
            {versions.map((version) => (
              <Box key={version.id}>
                <Typography variant="h3">
                  Version {version.version} · {version.status.toLowerCase()}
                </Typography>
                <Typography>{version.title || 'Untitled historical version'}</Typography>
                <Typography variant="caption">
                  Created {new Date(version.createdAt).toLocaleString()}
                  {version.approvedAt
                    ? ` · Approved ${new Date(version.approvedAt).toLocaleString()}`
                    : ' · Not approved'}
                </Typography>
                <Button
                  onClick={(event) => {
                    inspectTrigger.current = event.currentTarget;
                    setSelected(version);
                    setCompare(false);
                  }}
                >
                  Inspect version {version.version}
                </Button>
              </Box>
            ))}
          </Stack>
          {query.hasNextPage && (
            <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {query.isFetchingNextPage ? 'Loading older versions...' : 'Load older versions'}
            </Button>
          )}
          {selected && (
            <Box
              ref={detailsRef}
              role="region"
              aria-label={`Version ${selected.version} details`}
              tabIndex={-1}
              sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
            >
              <Typography variant="h2">Inspecting version {selected.version}</Typography>
              <Button onClick={() => setCompare(!compare)}>
                {compare ? 'Hide comparison' : 'Compare with working copy'}
              </Button>
              {compare && (
                <PlanDraftComparison
                  local={workingDraft}
                  saved={draftFromBuilder({
                    plan: {
                      id: planId,
                      title: selected.title || 'Untitled historical version',
                      purpose: selected.purpose || 'NURTURE',
                      status: selected.status,
                      versions: [selected],
                    },
                    context: {},
                  })}
                />
              )}

              <Button
                onClick={() => {
                  setSelected(null);
                  inspectTrigger.current?.focus();
                }}
              >
                Close version inspection
              </Button>
              <PlanLifecyclePreview
                key={selected.id}
                clientId={clientId}
                draft={draftFromBuilder({
                  plan: {
                    id: planId,
                    title: selected.title || 'Untitled historical version',
                    purpose: selected.purpose || 'NURTURE',
                    status: selected.status,
                    versions: [selected],
                  },
                  context: {},
                })}
              />
            </Box>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
