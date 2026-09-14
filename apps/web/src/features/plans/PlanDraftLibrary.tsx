import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import { PreviousPlanDraft } from './PreviousPlanDraft';
import type { DraftResult } from './SavedPlanResponse';
type Page = {
  drafts: Array<NonNullable<DraftResult['previousDraft']> & { id: string; planTitle: string }>;
  nextBefore: string | null;
};

export function PlanDraftLibrary() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['plan-draft-library'],
    enabled: open,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiRequest<Page>(
        `/api/v1/client/plan/drafts${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (page) => page.nextBefore ?? undefined,
  });
  const rows = [
    ...new Map(
      query.data?.pages.flatMap((page) => page.drafts).map((draft) => [draft.id, draft]) ?? [],
    ).values(),
  ];
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError) throw result.error;
    await client.invalidateQueries({ queryKey: ['plan-response-draft'] });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Saved response library</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        aria-label="Saved response library"
      >
        <DialogTitle>Saved response library</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography>
              Private drafts from your Plans, including steps that have been replaced or removed.
              Inspect the original instructions before reusing text. Drafts have not been submitted.
            </Typography>
            {query.isLoading && <Typography role="status">Loading saved responses...</Typography>}
            {query.isError && (
              <Alert
                severity="error"
                action={<Button onClick={() => void query.refetch()}>Retry</Button>}
              >
                Saved responses could not be loaded.
              </Alert>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <Typography>No private response drafts are saved.</Typography>
            )}
            {rows.map((draft) => (
              <Stack key={draft.id} spacing={1}>
                <Typography variant="subtitle2">
                  {draft.planTitle} · {draft.title}
                </Typography>
                <PreviousPlanDraft draft={draft} earlier={false} onRefresh={refresh} />
                <Divider />
              </Stack>
            ))}
            {query.hasNextPage && (
              <Button
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Load more drafts
              </Button>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close library</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
