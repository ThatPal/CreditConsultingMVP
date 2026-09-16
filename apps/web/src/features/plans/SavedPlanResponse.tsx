import { ResponseWritePause, usePendingNavigationWork } from '../../NavigationProtection';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import { subscribeToSessionLoss } from '../../auth/sessionLoss';
import { PlanResponse, type ResponseItem } from './PlanResponse';
import { EvidenceFile, type PlanFile } from './PlanAttachments';
import { PreviousPlanDraft } from './PreviousPlanDraft';
import { DiscardPlanDraft } from './DiscardPlanDraft';

export type ResponseDraft = {
  values: Record<string, string>;
  note: string;
  help: boolean;
  files: PlanFile[];
};
export type DraftResult = {
  contextVersion: string;
  active: boolean;
  previousDraft?:
    | (ResponseDraft & {
        id?: string;
        itemId?: string;
        revision?: number;
        version: number;
        title: string;
        body: string | null;
        responseForm: ResponseItem['responseForm'];
        updatedAt: string;
        unavailableFiles: number;
      })
    | null;
  draft:
    | (ResponseDraft & {
        id?: string;
        itemId?: string;
        revision: number;
        updatedAt: string;
        unavailableFiles: number;
        contextChanged?: boolean;
      })
    | null;
};

export function SavedPlanResponse({
  item,
  readOnly = false,
}: {
  item: ResponseItem;
  readOnly?: boolean;
}) {
  const client = useQueryClient();
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    const unsubscribe = subscribeToSessionLoss(() => {
      active.current = false;
    });
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, []);
  const [choice, setChoice] = useState<'resume' | 'blank' | null>(null);
  const [accepted, setAccepted] = useState<DraftResult | null>(null);
  const [generation, setGeneration] = useState(0);
  const [confirmReload, setConfirmReload] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [checkNeeded, setCheckNeeded] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saveAcknowledged, setSaveAcknowledged] = useState(false);
  const pending = usePendingNavigationWork();
  const inheritedPause = useContext(ResponseWritePause);

  const queryKey = ['plan-response-draft', item.id];
  const path = `/api/v1/client/plan/items/${item.id}/draft`;
  const query = useQuery({
    queryKey,
    queryFn: () => apiRequest<DraftResult>(path),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    throwOnError: false,
  });
  useEffect(() => {
    // A recovery prompt has no editable local answers; an open form does.
    if (query.data && (!accepted || (choice === null && accepted.draft))) setAccepted(query.data);
  }, [query.data, accepted, choice]);
  const identity = (value: DraftResult | null | undefined) =>
    JSON.stringify([
      value?.contextVersion,
      value?.active,
      value?.draft?.id,
      value?.draft?.revision ?? 0,
    ]);
  const changed = Boolean(accepted && query.data && identity(accepted) !== identity(query.data));
  const blocked = inheritedPause || changed || query.isError || confirmingSave;
  const pauseMessage = inheritedPause
    ? 'Saving and submission are paused while the Plan needs confirmation. Your local answers remain here.'
    : changed
      ? 'A different saved response is available. Review it before saving or submitting.'
      : query.isError
        ? 'Saving and submission are paused. Retry the saved-response check; your local answers remain here.'
        : 'Your save was accepted. Checking the latest saved response before you continue...';
  const busy = pending.busy || writeBusy;
  if (query.isLoading && !accepted)
    return <Typography role="status">Checking for a saved response...</Typography>;
  if ((query.isError || !query.data) && !accepted)
    return (
      <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>
        Your saved response could not be loaded.
      </Alert>
    );
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError) throw result.error;
  };
  const data = accepted ?? query.data!;
  const saved = data.draft;
  const discardSaved =
    saved?.id && saved.itemId ? (
      <DiscardPlanDraft
        draft={{ id: saved.id, itemId: saved.itemId, revision: saved.revision }}
        onRefresh={refresh}
      />
    ) : null;
  const renderCurrent = () => {
    if (readOnly || !data.active)
      return (
        <Stack spacing={2}>
          <Alert severity="info">
            Responses are paused for this step. Your consultant owns the next review.
            {saved && ' Your saved draft is still private and has not been submitted.'}
          </Alert>
          {saved && (
            <>
              <Typography variant="subtitle2">Your saved response</Typography>
              {discardSaved}
              {Object.entries(saved.values).map(([key, value], index) => (
                <TextField
                  key={key}
                  label={
                    item.responseForm?.fields.find((field) => field.key === key)?.label ??
                    `Saved answer ${index + 1}`
                  }
                  value={value}
                  multiline
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              ))}
              {saved.note && (
                <TextField
                  label={saved.help ? 'Saved help request' : 'Saved note'}
                  value={saved.note}
                  multiline
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              )}
              {saved.files.map((file) => (
                <EvidenceFile key={file.documentId} file={file} />
              ))}
              {Boolean(saved.unavailableFiles) && (
                <Alert severity="warning">
                  Some saved attachments are no longer available. Your saved answers remain here.
                </Alert>
              )}
            </>
          )}
        </Stack>
      );
    if (saved && !choice)
      return (
        <Alert severity="info">
          {saved.contextChanged && (
            <Typography>
              The step changed since this draft was saved. Review the current instructions and your
              restored answers before submitting.
            </Typography>
          )}
          A private response draft was saved {new Date(saved.updatedAt).toLocaleString()}. It has
          not been submitted to your consultant.
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Button onClick={() => setChoice('resume')}>Resume saved response</Button>
            <Button onClick={() => setChoice('blank')}>Start a new response</Button>
            {discardSaved}
          </Stack>
        </Alert>
      );
    return (
      <>
        {choice === 'resume' && Boolean(saved?.unavailableFiles) && (
          <Alert severity="warning">
            Some saved attachments are no longer available. Your answers are restored; select
            current files before submitting.
          </Alert>
        )}
        <PlanResponse
          key={generation}
          draftRevision={data.draft?.revision ?? 0}
          draftId={data.draft?.id ?? null}
          draftContextVersion={data.contextVersion}
          item={item}
          pauseMessage={pauseMessage}
          draft={choice === 'resume' && saved ? saved : undefined}
          onSaveDraft={async (draft) => {
            if (blocked)
              throw new Error(
                'Review the saved response update before saving. Your local answers are still here.',
              );
            const current = data;
            setWriteBusy(true);
            setSaveAcknowledged(false);
            try {
              const result = await apiRequest<DraftResult>(path, {
                method: 'PUT',
                body: JSON.stringify({
                  expectedRevision: current.draft?.revision ?? 0,
                  expectedDraftId: current.draft?.id ?? null,
                  contextVersion: current.contextVersion,
                  values: draft.values,
                  note: draft.note,
                  help: draft.help,
                  documentIds: draft.files.map((file) => file.documentId),
                }),
              });
              if (!active.current) return;
              // A read started before this acknowledgment may be obsolete. Keep
              // any changed observation, then confirm the current server state.
              await client.cancelQueries({ queryKey, exact: true }, { revert: false });
              if (!active.current) return;
              const observed = client.getQueryData<DraftResult>(queryKey);
              const changedWhileSaving =
                observed &&
                identity(observed) !== identity(current) &&
                identity(observed) !== identity(result);
              setSaveAcknowledged(true);
              setCheckNeeded(false);
              setChoice('resume');
              setAccepted(result);
              client.setQueryData(queryKey, changedWhileSaving ? observed : result);
              setConfirmingSave(true);
              void client.invalidateQueries({ queryKey, exact: true }).finally(() => {
                if (active.current) setConfirmingSave(false);
              });
            } catch (error) {
              if (active.current) setCheckNeeded(true);
              throw error;
            } finally {
              if (active.current) setWriteBusy(false);
            }
          }}
        />
      </>
    );
  };
  return (
    <ResponseWritePause.Provider value={blocked}>
      <Stack spacing={2}>
        {checkNeeded && !changed && (
          <Button disabled={busy || query.isFetching} onClick={() => void query.refetch()}>
            Check latest saved response
          </Button>
        )}
        {changed && (
          <Alert
            severity="warning"
            action={
              <Button disabled={busy} onClick={() => setConfirmReload(true)}>
                Review saved response update
              </Button>
            }
          >
            The saved response changed outside this form. Your local answers are still here. Saving
            and submission are paused.
          </Alert>
        )}
        {query.isError && accepted && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy} onClick={() => void query.refetch()}>
                Retry draft lookup
              </Button>
            }
          >
            {saveAcknowledged
              ? 'Your last save was accepted, but the latest saved response could not be checked. Retry this check before continuing; it will not repeat that save.'
              : 'The saved response could not be refreshed. Your local answers remain here.'}
          </Alert>
        )}
        <Dialog
          open={confirmReload}
          onClose={() => {
            if (!busy) setConfirmReload(false);
          }}
          aria-label="Load saved response update"
        >
          <DialogTitle>Load the saved response update?</DialogTitle>
          <DialogContent>
            Copy any local text you want to keep. Loading this update replaces this form with the
            saved response and discards unsaved edits.
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setConfirmReload(false)}>
              Keep local answers
            </Button>
            <Button
              disabled={busy || !query.data || query.isError}
              onClick={() => {
                setAccepted(query.data!);
                setChoice(null);
                setGeneration((value) => value + 1);
                setConfirmReload(false);
              }}
            >
              Load saved response
            </Button>
          </DialogActions>
        </Dialog>
        {query.data?.previousDraft && (
          <PreviousPlanDraft draft={query.data.previousDraft} onRefresh={refresh} />
        )}
        {renderCurrent()}
      </Stack>
    </ResponseWritePause.Provider>
  );
}
