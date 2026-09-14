import { Alert, AlertTitle, Typography } from '@mui/material';
import type { ClientPlanItem } from '../../pages/PlanPages';

export function PlanFollowUp({ item, canAct }: { item: ClientPlanItem; canAct: boolean }) {
  const latest = item.history?.at(-1);
  if (
    item.owner !== 'CLIENT' ||
    !['AVAILABLE', 'IN_PROGRESS'].includes(item.status) ||
    !latest ||
    latest.id !== item.latestOutcomeId ||
    !['CORRECTION_REQUESTED', 'HELP_RESOLVED'].includes(latest.kind)
  )
    return null;
  const correction = latest.kind === 'CORRECTION_REQUESTED';
  const note = typeof latest.data?.note === 'string' ? latest.data.note.trim() : '';
  return (
    <Alert severity={correction ? 'warning' : 'info'}>
      <AlertTitle>
        {correction ? 'Your consultant requested an update' : 'Your consultant replied'}
      </AlertTitle>
      {note && (
        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mb: 1 }}>
          {note}
        </Typography>
      )}
      <Typography variant="body2">
        {!canAct
          ? 'Your consultant is reviewing this Plan. Keep this message for when the step reopens.'
          : correction
            ? 'Next step: review this feedback and submit an updated response below. Your earlier response stays in the history.'
            : 'Next step: follow this guidance and continue below. This step has reopened; it has not been marked complete.'}
      </Typography>
    </Alert>
  );
}
