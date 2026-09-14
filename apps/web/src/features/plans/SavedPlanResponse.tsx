import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
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
  const [choice, setChoice] = useState<'resume' | 'blank' | null>(null);
  const queryKey = ['plan-response-draft', item.id];
  const path = `/api/v1/client/plan/items/${item.id}/draft`;
  const query = useQuery({
    queryKey,
    queryFn: () => apiRequest<DraftResult>(path),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
  if (query.isLoading)
    return <Typography role="status">Checking for a saved response...</Typography>;
  if (query.isError || !query.data)
    return (
      <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>
        Your saved response could not be loaded.
      </Alert>
    );
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError) throw result.error;
  };
  const saved = query.data.draft;
  const data = query.data;
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
          draftRevision={data.draft?.revision ?? 0}
          draftContextVersion={data.contextVersion}
          item={item}
          draft={choice === 'resume' && saved ? saved : undefined}
          onSaveDraft={async (draft) => {
            const current = client.getQueryData<DraftResult>(queryKey) ?? query.data!;
            const result = await apiRequest<DraftResult>(path, {
              method: 'PUT',
              body: JSON.stringify({
                expectedRevision: current.draft?.revision ?? 0,
                contextVersion: current.contextVersion,
                values: draft.values,
                note: draft.note,
                help: draft.help,
                documentIds: draft.files.map((file) => file.documentId),
              }),
            });
            setChoice('resume');
            client.setQueryData(queryKey, result);
          }}
        />
      </>
    );
  };
  return (
    <Stack spacing={2}>
      {data.previousDraft && <PreviousPlanDraft draft={data.previousDraft} onRefresh={refresh} />}
      {renderCurrent()}
    </Stack>
  );
}
