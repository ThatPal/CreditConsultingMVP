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
  const [note, setNote] = useState('');
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
        item.status === 'AWAITING_VERIFICATION' ||
        (item.status === 'AVAILABLE' && item.completionMode === 'CONSULTANT_VERIFY'),
    ) ?? [];
  const item = pending.find((item) => item.id === selected) ?? pending[0];
  const review = useMutation({
    mutationFn: ({
      decision,
      itemId,
      evidenceId,
    }: {
      decision: 'VERIFY' | 'RETURN';
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
  if (!pending.length) return null;
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
          {pending.length} {pending.length === 1 ? 'step needs' : 'steps need'} verification
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review the client's saved response. Verify it to unlock eligible next steps, or explain
          exactly what needs correcting.
        </Typography>
        {plan?.status !== 'ACTIVE' && (
          <Alert severity="warning">
            This published Plan is paused. Review its sources and approve the replacement before
            verifying work.
          </Alert>
        )}
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
          {pending.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.title}
            </MenuItem>
          ))}
        </TextField>
        {item && (
          <>
            <Typography>{item.body}</Typography>
            <ResponseHistory item={item} consultant />
            <TextField
              label="Message to the client"
              helperText="Required for a correction request. This message becomes part of the client-visible history."
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
                onClick={() =>
                  review.mutate({
                    decision: 'VERIFY',
                    itemId: item.id,
                    evidenceId: item.latestOutcomeId ?? null,
                  })
                }
              >
                Verify completion
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
      </Stack>
    </Box>
  );
}
