import { useEffect, useState } from 'react';
import { reviewNotesKey, useReviewNotes } from './reviewNotes';
import { Alert, Box, Button, Drawer, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigationProtection } from '../../NavigationProtection';
import { apiRequest } from '../../auth/api';
import type { ClientPlanResponse } from '../../pages/PlanPages';
import { ResponseHistory } from './PlanResponse';

export function PlanExecutionReview({
  clientId,
  planId,
  actorId,
}: {
  clientId: string;
  planId?: string;
  actorId?: string;
}) {
  const client = useQueryClient();
  const [search] = useSearchParams();
  const requestedStep = search.get('stepKey');
  const [selected, setSelected] = useState('');
  const [showAll, setShowAll] = useState(Boolean(requestedStep));
  const [notesOpen, setNotesOpen] = useState(false);
  const storageKey = actorId && planId ? reviewNotesKey(actorId, clientId, planId) : undefined;
  const { notes, put, failed: storageFailed } = useReviewNotes(storageKey);
  const [localError, setLocalError] = useState('');
  const query = useQuery({
    queryKey: planId ? ['plan-execution', clientId, planId] : ['plan-execution', clientId],
    queryFn: () =>
      apiRequest<ClientPlanResponse>(
        `/api/v1/consultant/clients/${clientId}/plan/execution${planId ? `?planId=${encodeURIComponent(planId)}` : ''}`,
      ),
  });
  const plan = query.data?.plan;
  const pending =
    plan?.version?.items.filter(
      (item) =>
        item.status === 'UNABLE' ||
        item.status === 'AWAITING_VERIFICATION' ||
        (item.status === 'AVAILABLE' && item.completionMode === 'CONSULTANT_VERIFY'),
    ) ?? [];
  const visibleItems = showAll ? (plan?.version?.items ?? []) : pending;
  const item = selected
    ? visibleItems.find((item) => item.id === selected)
    : requestedStep
      ? visibleItems.find((item) => item.stableKey === requestedStep)
      : visibleItems[0];
  const canReview = Boolean(item && pending.some((row) => row.id === item.id));
  const needsHelp = item?.status === 'UNABLE';
  const savedNote = notes[item?.id ?? ''];
  const note = savedNote?.text ?? '';
  const staleNote = Boolean(savedNote && savedNote.evidenceId !== (item?.latestOutcomeId ?? null));
  const setNote = (value: string) => {
    if (item)
      put(item.id, {
        text: value,
        title: item.title,
        evidenceId: savedNote ? savedNote.evidenceId : (item.latestOutcomeId ?? null),
        updatedAt: Date.now(),
      });
  };
  const review = useMutation({
    mutationFn: ({
      decision,
      itemId,
      evidenceId,
    }: {
      decision: 'VERIFY' | 'RETURN' | 'RESUME';
      itemId: string;
      evidenceId: string | null;
    }) =>
      apiRequest(`/api/v1/consultant/clients/${clientId}/plan/items/${itemId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision, expectedOutcomeId: evidenceId, note: note.trim() }),
      }),
    onSuccess: async (_result, variables) => {
      put(variables.itemId, null);
      setLocalError('');
      await Promise.all(
        [
          'plan-execution',
          'plan-builder',
          'client-plan',
          'work-queue',
          'shell-client-context',
          'portal-home',
          'portal-journey',
        ].map((root) => client.invalidateQueries({ queryKey: [root] })),
      );
    },
  });
  useNavigationProtection(
    Object.values(notes).some((note) => Boolean(note.text.trim())),
    review.isPending,
  );
  useEffect(() => {
    if (!Object.keys(notes).length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [notes]);
  const noteRecovery = (
    <>
      {Object.keys(notes).length > 0 && (
        <Button onClick={() => setNotesOpen(true)}>
          Unsent messages ({Object.keys(notes).length})
        </Button>
      )}
      {storageKey && (Object.keys(notes).length > 0 || storageFailed) && (
        <Alert severity={storageFailed ? 'warning' : 'info'}>
          {storageFailed
            ? 'This browser could not keep a recovery copy. Keep this page open until you send or copy your messages.'
            : 'Unsent messages are private and kept in this tab for up to 24 hours. Signing out clears them. They have not been sent to the client.'}
        </Alert>
      )}
      <Drawer
        anchor="right"
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', md: 520 }, p: 3 } } }}
      >
        <Stack spacing={2}>
          <Typography variant="h2">Unsent review messages</Typography>
          <Button onClick={() => setNotesOpen(false)}>Close messages</Button>
          {Object.entries(notes).map(([id, saved]) => (
            <Stack key={id} spacing={1}>
              <Typography variant="h3">{saved.title}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{saved.text}</Typography>
              {!plan?.version.items.some((item) => item.id === id) && (
                <Alert severity="info">
                  This message belongs to an earlier or unavailable step. It has not been attached
                  to another response.
                </Alert>
              )}
              <Button disabled={review.isPending} onClick={() => put(id, null)}>
                Discard message for {saved.title}
              </Button>
            </Stack>
          ))}
        </Stack>
      </Drawer>
    </>
  );
  if (query.isError)
    return (
      <Alert severity="error">
        {noteRecovery}
        Plan responses could not be loaded.{' '}
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </Alert>
    );
  if (query.isLoading) return <Typography role="status">Loading Plan responses...</Typography>;
  if (!plan?.version?.items.length && Object.keys(notes).length)
    return <Stack spacing={2}>{noteRecovery}</Stack>;
  if (!plan?.version?.items.length)
    return requestedStep ? (
      <Alert severity="info">
        This linked step is not available in the Plan's current published version. Review the saved
        version history for earlier work.
      </Alert>
    ) : null;
  return (
    <Box
      component="section"
      aria-label="Submitted Plan work"
      sx={{
        p: { xs: 2, md: 3 },
        borderLeft: 3,
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        {noteRecovery}
        {requestedStep && !item && (
          <Alert severity="info">
            The linked step is not in this view. Choose another step or inspect the saved version
            history.
          </Alert>
        )}
        <Typography variant="overline">Published Plan · Response review</Typography>
        <Typography variant="h3">
          {showAll
            ? 'Published step history'
            : pending.some((row) => row.status === 'UNABLE')
              ? `${pending.length} ${pending.length === 1 ? 'step needs' : 'steps need'} attention`
              : `${pending.length} ${pending.length === 1 ? 'step needs' : 'steps need'} verification`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review responses and supporting files, answer requests for help, and keep completed work
          accessible.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {[false, true].map((all) => (
            <Button
              key={String(all)}
              variant={showAll === all ? 'contained' : 'outlined'}
              aria-pressed={showAll === all}
              disabled={review.isPending}
              onClick={() => {
                setShowAll(all);
                setSelected('');
                setLocalError('');
                review.reset();
              }}
            >
              {all
                ? `All steps (${plan.version.items.length})`
                : `Needs attention (${pending.length})`}
            </Button>
          ))}
        </Stack>
        {!showAll && !pending.length && (
          <Alert severity="success">
            No steps need your attention. Open All steps to review previous responses and decisions.
          </Alert>
        )}
        {plan?.status !== 'ACTIVE' && (
          <Alert severity="warning">
            This published Plan is paused. Review its sources and approve the replacement before
            verifying work.
          </Alert>
        )}
        {visibleItems.length > 0 && (
          <TextField
            select
            label="Step to review"
            value={item?.id ?? ''}
            disabled={review.isPending}
            onChange={(e) => {
              setSelected(e.target.value);
              setLocalError('');
              review.reset();
            }}
          >
            {visibleItems.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.title}
                {showAll ? ` - ${item.status.toLowerCase().replaceAll('_', ' ')}` : ''}
              </MenuItem>
            ))}
          </TextField>
        )}
        {item && (
          <>
            <Typography>{item.body}</Typography>
            <ResponseHistory
              key={`${item.id}:${item.latestOutcomeId}`}
              item={item}
              consultant
              clientId={clientId}
            />
            {!item.history?.length && (
              <Typography color="text.secondary">
                No responses have been submitted for this step.
              </Typography>
            )}
            {canReview && (
              <>
                <TextField
                  label="Message to the client"
                  helperText={
                    needsHelp
                      ? 'Explain how to continue. Sending your reply reopens the step for the client without marking it complete.'
                      : 'Required for a correction request. This message becomes part of the client-visible history.'
                  }
                  multiline
                  minRows={2}
                  value={note}
                  disabled={review.isPending}
                  onChange={(e) => setNote(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
                {staleNote && (
                  <Alert severity="warning">
                    The client response changed since this message was written. Review the latest
                    evidence before using it.
                    <Button
                      disabled={review.isPending}
                      onClick={() => {
                        if (item && savedNote)
                          put(item.id, {
                            ...savedNote,
                            evidenceId: item.latestOutcomeId ?? null,
                            updatedAt: Date.now(),
                          });
                      }}
                    >
                      I reviewed the latest response
                    </Button>
                  </Alert>
                )}
                {(localError || review.isError) && (
                  <Alert severity="error">
                    {localError || review.error?.message}
                    {review.error && 'status' in review.error && review.error.status === 403 && (
                      <Button
                        component={Link}
                        to={`/mfa?mode=challenge&returnTo=${encodeURIComponent(`/crm/clients/${clientId}/plan?${new URLSearchParams({ ...(planId ? { planId } : {}), ...(item?.stableKey ? { stepKey: item.stableKey } : {}) }).toString()}`)}`}
                      >
                        Verify identity and return
                      </Button>
                    )}
                  </Alert>
                )}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={review.isPending || staleNote || plan?.status !== 'ACTIVE'}
                    onClick={() => {
                      if (needsHelp && !note.trim()) {
                        setLocalError('Explain how the client can continue.');
                        return;
                      }
                      review.mutate({
                        decision: needsHelp ? 'RESUME' : 'VERIFY',
                        itemId: item.id,
                        evidenceId: item.latestOutcomeId ?? null,
                      });
                    }}
                  >
                    {needsHelp ? 'Send guidance & reopen step' : 'Verify completion'}
                  </Button>
                  {item.status === 'AWAITING_VERIFICATION' && (
                    <Button
                      disabled={review.isPending || staleNote || plan?.status !== 'ACTIVE'}
                      onClick={() => {
                        if (!note.trim()) {
                          setLocalError('Explain what the client should correct.');
                          return;
                        }
                        review.mutate({
                          decision: 'RETURN',
                          itemId: item.id,
                          evidenceId: item.latestOutcomeId ?? null,
                        });
                      }}
                    >
                      Request correction
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
