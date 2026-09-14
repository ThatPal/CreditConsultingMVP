import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiRequest } from '../../auth/api';
import { useNavigationProtection } from '../../NavigationProtection';

export function CancelPrivatePlan({
  clientId,
  planId,
  title,
  revision,
  disabled,
}: {
  clientId: string;
  planId: string;
  title: string;
  revision: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState<{
    key: string;
    expectedVersion: number;
    reason: string;
  } | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const request = attempt ?? {
        key: crypto.randomUUID(),
        expectedVersion: revision,
        reason: reason.trim(),
      };
      setAttempt(request);
      return apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${planId}/cancel`, {
        method: 'POST',
        headers: { 'Idempotency-Key': request.key },
        body: JSON.stringify({ expectedVersion: request.expectedVersion, reason: request.reason }),
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setReason('');
      setAttempt(null);
      await Promise.all(
        ['plan-builder', 'plan-library', 'plan-version-history', 'work-queue'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  useNavigationProtection(open && Boolean(reason.trim()), mutation.isPending);
  return (
    <>
      <Button color="warning" disabled={disabled} onClick={() => setOpen(true)}>
        Cancel unpublished Plan
      </Button>
      <Dialog
        open={open}
        onClose={() => !mutation.isPending && setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Cancel this unpublished Plan?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="h3">{title}</Typography>
            <Alert severity="info">
              This closes the saved draft and its open Plan review reminders. Its steps, versions
              and cancellation reason remain in history. The client's published Plan is unchanged.
            </Alert>
            <TextField
              label="Reason for cancellation"
              multiline
              minRows={3}
              value={reason}
              disabled={mutation.isPending || Boolean(attempt)}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            {mutation.isError && (
              <Alert severity="error">
                {mutation.error.message} Reopen the Plan library to check its latest status.
                Retrying here sends the same cancellation request.
                <Button
                  onClick={() =>
                    void client.invalidateQueries({ queryKey: ['plan-builder', clientId] })
                  }
                >
                  Refresh saved Plan
                </Button>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={mutation.isPending} onClick={() => setOpen(false)}>
            Keep reviewing
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={mutation.isPending || !reason.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Cancelling...'
              : attempt
                ? 'Retry cancellation'
                : 'Cancel this Plan'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
