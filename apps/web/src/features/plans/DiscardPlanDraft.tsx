import { useId, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';

export function DiscardPlanDraft({
  draft,
  onRefresh,
}: {
  draft: { id: string; itemId: string; revision: number };
  onRefresh: () => Promise<void>;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<typeof draft | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const discard = useMutation({
    mutationFn: (target: typeof draft) =>
      apiRequest(`/api/v1/client/plan/items/${target.itemId}/draft`, {
        method: 'DELETE',
        body: JSON.stringify({ draftId: target.id, revision: target.revision }),
      }),
    onSuccess: async () => {
      await onRefresh();
      setSelected(null);
    },
  });
  const busy = discard.isPending || refreshing;
  return (
    <>
      <Button
        color="error"
        onClick={() => {
          discard.reset();
          setRefreshError('');
          setSelected({ ...draft });
        }}
      >
        Discard saved draft
      </Button>
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        aria-labelledby={titleId}
      >
        <DialogTitle id={titleId}>Discard this saved draft?</DialogTitle>
        <DialogContent>
          This removes these private saved answers and notes. Uploaded documents and submitted
          responses stay in your history. This cannot be undone.
          {(discard.isError || refreshError) && (
            <Alert severity="error">{refreshError || discard.error?.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setSelected(null)}>
            Keep draft
          </Button>
          {discard.isError && (
            <Button
              disabled={busy}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                  setSelected(null);
                } catch {
                  setRefreshError(
                    'The saved response could not be refreshed. Your draft has not been discarded by this refresh.',
                  );
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              Refresh saved response
            </Button>
          )}
          <Button
            color="error"
            disabled={busy}
            onClick={() => {
              if (selected) discard.mutate(selected);
            }}
          >
            Discard this draft
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
