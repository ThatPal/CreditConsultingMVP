import { useState } from 'react';
import { Alert, Button, Drawer, Stack, TextField, Typography } from '@mui/material';
import { EvidenceFile } from './PlanAttachments';
import type { DraftResult } from './SavedPlanResponse';

export function PreviousPlanDraft({ draft }: { draft: NonNullable<DraftResult['previousDraft']> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Alert
        severity="info"
        action={<Button onClick={() => setOpen(true)}>View earlier draft</Button>}
      >
        You have a private unfinished response from Plan version {draft.version}.
      </Alert>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, p: 3 } } }}
      >
        <Stack spacing={2} role="region" aria-label="Earlier saved response">
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Earlier saved response</Typography>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Stack>
          <Typography variant="caption">
            Plan version {draft.version} · Saved {new Date(draft.updatedAt).toLocaleString()}
          </Typography>
          <Alert severity="info">
            These answers were not submitted. Review the current instructions before reusing any
            text. Opening this draft does not change your current response.
          </Alert>
          <Typography variant="h6">{draft.title}</Typography>
          {draft.body && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{draft.body}</Typography>}
          {Object.entries(draft.values).map(([key, value], index) => (
            <TextField
              key={key}
              label={
                draft.responseForm?.fields.find((field) => field.key === key)?.label ??
                `Saved answer ${index + 1}`
              }
              value={value}
              multiline
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
          ))}
          {draft.note && (
            <TextField
              label={draft.help ? 'Earlier help request' : 'Earlier note'}
              value={draft.note}
              multiline
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
          )}
          {draft.files.map((file) => (
            <EvidenceFile key={file.documentId} file={file} />
          ))}
          {Boolean(draft.unavailableFiles) && (
            <Alert severity="warning">Some earlier attachments are no longer available.</Alert>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
