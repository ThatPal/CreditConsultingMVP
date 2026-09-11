import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../auth/api';
import type { ResponseDraft } from './SavedPlanResponse';
import { EvidenceFile, PlanAttachments, type PlanFile } from './PlanAttachments';

export type ResponseField = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  required: boolean;
  description?: string;
  options?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
};
export type Evidence = {
  id: string;
  kind: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  responseSnapshot?: ResponseField[] | null;
  attachments?: PlanFile[];
};
export type ResponseItem = {
  id: string;
  completionMode: string;
  type: string;
  responseForm?: { fields: ResponseField[]; error: string | null };
  history?: Evidence[];
  historyLimited?: boolean;
  latestOutcomeId?: string | null;
};
export function ResponseHistory({
  item,
  consultant = false,
  clientId,
}: {
  item: ResponseItem;
  consultant?: boolean;
  clientId?: string;
}) {
  const [older, setOlder] = useState<Evidence[]>([]);
  const [hasMore, setHasMore] = useState(Boolean(item.historyLimited));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const history = [...older, ...(item.history ?? [])];
  async function loadOlder() {
    if (loading || !history[0]) return;
    setLoading(true);
    setError('');
    try {
      const base = consultant
        ? `/api/v1/consultant/clients/${clientId}/plan`
        : '/api/v1/client/plan';
      const page = await apiRequest<{ history: Evidence[]; historyLimited: boolean }>(
        `${base}/items/${item.id}/history?before=${encodeURIComponent(history[0].id)}`,
      );
      setOlder((current) => [
        ...page.history.filter((row) => !history.some((existing) => existing.id === row.id)),
        ...current,
      ]);
      setHasMore(page.historyLimited);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Older history could not be loaded. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }
  if (!history.length) return null;
  const labels: Record<string, string> = {
    COMPLETE: consultant ? 'Client submitted an update' : 'You submitted an update',
    UNABLE: consultant ? 'Client requested help' : 'You requested help',
    VERIFIED: 'Consultant verified',
    HELP_RESOLVED: 'Consultant provided guidance and reopened this step',
    CORRECTION_REQUESTED: 'Consultant requested a correction',
  };
  return (
    <Box component="details" open={consultant} sx={{ mt: 2 }}>
      <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 600 }}>
        Response history · {history.length}
        {hasMore ? ' most recent' : ''}
      </Typography>
      {hasMore && (
        <Button disabled={loading} onClick={() => void loadOlder()} sx={{ mt: 1 }}>
          {loading ? 'Loading older responses...' : 'Load older responses'}
        </Button>
      )}
      {error && (
        <Alert severity="error">
          {error} Your loaded history is still available. Retry with Load older responses.
        </Alert>
      )}
      <Stack
        spacing={2}
        divider={<Divider />}
        role="region"
        aria-label="Response events"
        tabIndex={0}
        sx={{
          mt: 2,
          maxHeight: 'min(60vh, 560px)',
          overflowY: 'auto',
          pr: 1,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        {history.map((entry) => (
          <Box key={entry.id}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {labels[entry.kind] ?? 'Recorded update'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(entry.createdAt).toLocaleString()}
            </Typography>
            {entry.data &&
              Object.entries(entry.data)
                .filter(([, v]) => v !== '' && v !== null)
                .map(([key, value]) => (
                  <Typography
                    key={key}
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {(entry.responseSnapshot ?? item.responseForm?.fields)?.find(
                      (field) => field.key === key,
                    )?.label ??
                      (key === 'note' || key === 'reason' ? 'Note' : key.replace(/_/g, ' '))}
                    :{' '}
                    {typeof value === 'boolean'
                      ? value
                        ? 'Yes'
                        : 'No'
                      : typeof value === 'object'
                        ? 'Saved supporting information'
                        : String(value)}
                  </Typography>
                ))}
            {entry.attachments?.map((file) => (
              <EvidenceFile key={file.documentId} file={file} />
            ))}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function PlanResponse({
  item,
  draft,
  onSaveDraft,
  draftRevision,
  draftContextVersion,
}: {
  item: ResponseItem;
  draft?: ResponseDraft | undefined;
  draftRevision?: number;
  draftContextVersion?: string;
  onSaveDraft?: (draft: ResponseDraft) => Promise<void>;
}) {
  const client = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (draft) return draft.values;
    const previous = item.history?.filter((entry) => entry.kind === 'COMPLETE').at(-1)?.data;
    return Object.fromEntries(
      Object.entries(previous ?? {})
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => [key, String(value)]),
    );
  });
  const previousFiles =
    item.history?.filter((entry) => entry.kind === 'COMPLETE').at(-1)?.attachments ?? [];
  const [files, setFiles] = useState<PlanFile[]>(
    () =>
      draft?.files ?? previousFiles.filter((file) => file.available && file.status === 'AVAILABLE'),
  );
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState(draft?.note ?? '');
  const [help, setHelp] = useState(draft?.help ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const serialized = JSON.stringify({ values, note, help, files });
  const [savedPayload, setSavedPayload] = useState(serialized);
  const [hasSaved, setHasSaved] = useState(Boolean(draft));
  const dirty = serialized !== savedPayload;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    if (dirty || uploading) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, uploading]);
  async function saveDraft() {
    if (!onSaveDraft || saving || uploading) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSaveDraft({ values, note, help, files });
      setSavedPayload(serialized);
      setHasSaved(true);
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : 'The draft could not be saved. Your answers are still here.',
      );
    } finally {
      setSaving(false);
    }
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const fields = item.responseForm?.fields ?? [];
  const formError =
    item.responseForm?.error ??
    (item.completionMode === 'STRUCTURED_OUTCOME' && !fields.length
      ? 'Your consultant needs to configure this response form.'
      : null);
  const mutation = useMutation({
    mutationFn: (payload: {
      action: 'COMPLETE' | 'UNABLE';
      outcome?: Record<string, unknown>;
      reason?: string;
      documentIds?: string[];
    }) => {
      const serialized = JSON.stringify(payload);
      if (attempt.current?.payload !== serialized)
        attempt.current = { payload: serialized, key: crypto.randomUUID() };
      return apiRequest(`/api/v1/client/plan/items/${item.id}/outcomes`, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          idempotencyKey: attempt.current.key,
          draftRevision,
          draftContextVersion,
        }),
      });
    },
    onSuccess: async () => {
      setSavedPayload(serialized);
      client.removeQueries({ queryKey: ['plan-response-draft', item.id] });
      await Promise.all(
        ['client-plan', 'portal-home', 'portal-journey'].map((root) =>
          client.invalidateQueries({ queryKey: [root] }),
        ),
      );
    },
  });
  const submit = () => {
    if (uploading || saving || mutation.isPending) return;
    const issues: Record<string, string> = {};
    if (help) {
      if (!note.trim()) {
        setErrors({ note: 'Tell your consultant where you got stuck.' });
        return;
      }
      mutation.mutate({
        action: 'UNABLE',
        reason: note.trim(),
        documentIds: files.map((file) => file.documentId),
      });
      return;
    }
    const outcome: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.key] ?? '';
      if (!value.trim()) {
        if (field.required) issues[field.key] = `${field.label} is required.`;
        continue;
      }
      if (['number', 'integer'].includes(field.type)) {
        const number = Number(value);
        if (
          !Number.isFinite(number) ||
          (field.type === 'integer' && !Number.isInteger(number)) ||
          (field.minimum !== undefined && number < field.minimum) ||
          (field.maximum !== undefined && number > field.maximum)
        )
          issues[field.key] = 'Enter a number within the allowed range.';
        else outcome[field.key] = number;
      } else if (field.type === 'boolean') outcome[field.key] = value === 'true';
      else if (field.maxLength && value.length > field.maxLength)
        issues[field.key] = `Use at most ${field.maxLength} characters.`;
      else outcome[field.key] = value.trim();
    }
    setErrors(issues);
    if (Object.keys(issues).length) return;
    mutation.mutate({
      action: 'COMPLETE',
      documentIds: files.map((file) => file.documentId),
      outcome: fields.length ? outcome : { note: note.trim() },
    });
  };
  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      sx={{ pt: 2 }}
    >
      {item.history?.at(-1)?.kind === 'HELP_RESOLVED' && (
        <Alert severity="info">
          Your consultant has replied: {String(item.history.at(-1)?.data?.note ?? '')} You can
          continue this step below.
        </Alert>
      )}
      {item.history?.at(-1)?.kind === 'CORRECTION_REQUESTED' && (
        <Alert severity="warning">
          Your consultant requested a correction: {String(item.history.at(-1)?.data?.note ?? '')}
        </Alert>
      )}
      <Typography variant="h3">
        {help
          ? 'Tell us where you need help'
          : fields.length
            ? 'Your response'
            : 'Complete this step'}
      </Typography>
      {help ? (
        <TextField
          label="What do you need help with?"
          required
          multiline
          minRows={3}
          value={note}
          disabled={saving || mutation.isPending}
          onChange={(e) => setNote(e.target.value)}
          error={Boolean(errors.note)}
          helperText={errors.note ?? 'Your consultant will see this message and own the next step.'}
        />
      ) : (
        <>
          {formError && <Alert severity="warning">{formError}</Alert>}
          {fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              required={field.required}
              disabled={saving || mutation.isPending}
              select={field.type === 'boolean' || Boolean(field.options)}
              type={['number', 'integer'].includes(field.type) ? 'number' : 'text'}
              multiline={field.type === 'string' && !field.options}
              minRows={field.type === 'string' && !field.options ? 2 : undefined}
              value={values[field.key] ?? ''}
              onChange={(e) =>
                setValues((current) => ({ ...current, [field.key]: e.target.value }))
              }
              error={Boolean(errors[field.key])}
              helperText={
                errors[field.key] ??
                field.description ??
                (field.minimum !== undefined || field.maximum !== undefined
                  ? `Allowed range: ${field.minimum ?? 'no minimum'} to ${field.maximum ?? 'no maximum'}`
                  : undefined)
              }
              slotProps={{
                htmlInput: {
                  maxLength: field.maxLength,
                  min: field.minimum,
                  max: field.maximum,
                  step: field.type === 'integer' ? 1 : 'any',
                },
              }}
            >
              {field.type === 'boolean'
                ? [
                    <MenuItem key="yes" value="true">
                      Yes
                    </MenuItem>,
                    <MenuItem key="no" value="false">
                      No
                    </MenuItem>,
                  ]
                : field.options?.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
            </TextField>
          ))}
          {!fields.length && !formError && (
            <TextField
              label="Optional note for your consultant"
              multiline
              minRows={2}
              value={note}
              disabled={saving || mutation.isPending}
              onChange={(e) => setNote(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          )}
          {item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY' && (
            <Typography variant="body2" color="text.secondary">
              Your consultant will verify this response before the next dependent step opens.
            </Typography>
          )}
        </>
      )}
      {previousFiles.some((file) => !file.available || file.status !== 'AVAILABLE') && (
        <Alert severity="info">
          Some files from your previous response are no longer current. Their submission records
          remain in the history below. Select an available replacement if it supports your
          correction.
        </Alert>
      )}
      <PlanAttachments
        value={files}
        onChange={setFiles}
        disabled={saving || mutation.isPending}
        onBusyChange={setUploading}
      />
      {onSaveDraft && (
        <Stack spacing={1}>
          <Button
            disabled={saving || uploading || mutation.isPending || (hasSaved && !dirty)}
            onClick={() => void saveDraft()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Saving draft...' : 'Save draft'}
          </Button>
          <Typography variant="caption" role="status">
            {hasSaved && !dirty
              ? 'Draft saved privately. Your consultant has not received it.'
              : 'Save your draft before leaving to keep these answers. Submitting sends them to your consultant.'}
          </Typography>
          {saveError && <Alert severity="error">{saveError}</Alert>}
        </Stack>
      )}
      {mutation.isError && (
        <Alert severity="error">
          {mutation.error.message} Your response is still here. You can retry.
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saving || uploading || mutation.isPending || (!help && Boolean(formError))}
        >
          {mutation.isPending
            ? 'Saving…'
            : help
              ? 'Send help request'
              : item.type === 'GUIDANCE'
                ? 'I understand'
                : item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY'
                  ? 'Submit for verification'
                  : 'Save completed step'}
        </Button>
        <Button
          disabled={saving || mutation.isPending}
          onClick={() => {
            setHelp(!help);
            setErrors({});
          }}
        >
          {help ? 'Back to response' : 'I need help'}
        </Button>
      </Stack>
    </Stack>
  );
}
