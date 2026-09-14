import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { PlanDraft } from './editor';
export function PlanPathEditor({
  draft,
  disabled,
  onChange,
}: {
  draft: PlanDraft;
  disabled: boolean;
  onChange: (draft: PlanDraft) => void;
}) {
  return (
    <Box component="details" sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 2 }}>
      <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 700 }}>
        Plan paths · {draft.paths.length}
      </Typography>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="body2">
          Steps without a path are shared. Active and available paths are visible to the client.
          Choose at most one active path; required path-specific steps must belong to it. Changes
          take effect only after saving and approval.
        </Typography>
        {draft.paths.map((path) => {
          const members = draft.items.filter((item) => item.pathKeys.includes(path.key));
          return (
            <Stack key={path.key} spacing={1} sx={{ borderLeft: 2, borderColor: 'divider', pl: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  label="Path label"
                  value={path.clientLabel}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      paths: draft.paths.map((entry) =>
                        entry.key === path.key
                          ? { ...entry, clientLabel: event.target.value }
                          : entry,
                      ),
                    })
                  }
                  slotProps={{ htmlInput: { maxLength: 160 } }}
                />
                <TextField
                  select
                  label="Path status"
                  value={path.status}
                  disabled={disabled}
                  sx={{ minWidth: 160 }}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      paths: draft.paths.map((entry) =>
                        entry.key === path.key
                          ? { ...entry, status: event.target.value as typeof path.status }
                          : entry,
                      ),
                    })
                  }
                >
                  {['ACTIVE', 'AVAILABLE', 'INACTIVE', 'RETIRED'].map((status) => (
                    <MenuItem key={status} value={status}>
                      {status[0] + status.slice(1).toLowerCase()}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Typography variant="body2">
                {members.length} steps:{' '}
                {members.map((item) => item.clientTitle || 'Untitled step').join(', ') ||
                  'Assign steps using Paths containing this step.'}
              </Typography>
              <Button
                sx={{ alignSelf: 'flex-start' }}
                disabled={disabled || members.length > 0}
                onClick={() =>
                  onChange({
                    ...draft,
                    paths: draft.paths.filter((entry) => entry.key !== path.key),
                  })
                }
              >
                Remove unused path
              </Button>
            </Stack>
          );
        })}
        <Button
          disabled={disabled || draft.paths.length >= 20}
          sx={{ alignSelf: 'flex-start' }}
          onClick={() =>
            onChange({
              ...draft,
              paths: [
                ...draft.paths,
                {
                  key: `path-${crypto.randomUUID()}`,
                  clientLabel: 'New path',
                  internalLabel: null,
                  status: 'INACTIVE',
                  sortOrder: draft.paths.length,
                },
              ],
            })
          }
        >
          Add path
        </Button>
      </Stack>
    </Box>
  );
}
