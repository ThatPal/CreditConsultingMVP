import { useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../auth/api';
import type { ClientPlanResponse } from '../../pages/PlanPages';
import { ResponseHistory } from './PlanResponse';

export function PlanExecutionReview({ clientId }: { clientId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState('');
  const query = useQuery({
    queryKey: ['plan-execution', clientId],
    queryFn: () =>
      apiRequest<ClientPlanResponse>(`/api/v1/consultant/clients/${clientId}/plan/execution`),
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
  const item = visibleItems.find((item) => item.id === selected) ?? visibleItems[0];
  const canReview = Boolean(item && pending.some((row) => row.id === item.id));
  const needsHelp = item?.status === 'UNABLE';
  const note = notes[item?.id ?? ''] ?? '';
  const setNote = (value: string) =>
    setNotes((current) => ({ ...current, [item?.id ?? '']: value }));
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
    onSuccess: async () => {
      setNote('');
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
  if (query.isError)
    return (
      <Alert severity="error">
        Plan responses could not be loaded.{' '}
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </Alert>
    );
  if (query.isLoading) return <Typography role="status">Loading Plan responses...</Typography>;
  if (!plan?.version?.items.length) return null;
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
                setNote('');
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
              setNote('');
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
                {(localError || review.isError) && (
                  <Alert severity="error">
                    {localError || review.error?.message}
                    {review.error && 'status' in review.error && review.error.status === 403 && (
                      <Button
                        component={Link}
                        to={`/mfa?mode=challenge&returnTo=${encodeURIComponent(`/crm/clients/${clientId}/plan`)}`}
                      >
                        Verify identity and return
                      </Button>
                    )}
                  </Alert>
                )}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={review.isPending || plan?.status !== 'ACTIVE'}
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
                      disabled={review.isPending || plan?.status !== 'ACTIVE'}
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
