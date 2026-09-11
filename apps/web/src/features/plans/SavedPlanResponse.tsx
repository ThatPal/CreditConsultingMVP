import { useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import { PlanResponse, type ResponseItem } from './PlanResponse';
import type { PlanFile } from './PlanAttachments';

export type ResponseDraft = {
  values: Record<string, string>;
  note: string;
  help: boolean;
  files: PlanFile[];
};
export type DraftResult = {
  contextVersion: string;
  active: boolean;
  draft:
    | (ResponseDraft & {
        revision: number;
        updatedAt: string;
        unavailableFiles: number;
        contextChanged?: boolean;
      })
    | null;
};

export function SavedPlanResponse({ item }: { item: ResponseItem }) {
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
  if (!query.data.active)
    return (
      <Alert severity="info">
        This step has changed and cannot accept a response right now. Reload the Plan to see the
        latest status.
      </Alert>
    );
  const saved = query.data.draft;
  if (saved && !choice)
    return (
      <Alert severity="info">
        {saved.contextChanged && (
          <Typography>
            The step changed since this draft was saved. Review the current instructions and your
            restored answers before submitting.
          </Typography>
        )}
        A private response draft was saved {new Date(saved.updatedAt).toLocaleString()}. It has not
        been submitted to your consultant.
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setChoice('resume')}>Resume saved response</Button>
          <Button onClick={() => setChoice('blank')}>Start a new response</Button>
        </Stack>
      </Alert>
    );
  return (
    <>
      {choice === 'resume' && Boolean(saved?.unavailableFiles) && (
        <Alert severity="warning">
          Some saved attachments are no longer available. Your answers are restored; select current
          files before submitting.
        </Alert>
      )}
      <PlanResponse
        draftRevision={query.data.draft?.revision ?? 0}
        draftContextVersion={query.data.contextVersion}
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
}
