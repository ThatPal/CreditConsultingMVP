import { useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { hasProgress, type PlanDraft } from './editor';

type Choice = {
  key: string;
  label: string;
  local: string | null;
  saved: string | null;
  stepKey?: string;
  field: 'title' | 'clientTitle' | 'clientBody' | 'consultantRationale';
};
export function conflictChoices(local: PlanDraft, saved: PlanDraft): Choice[] {
  const choices: Choice[] = [];
  if (local.title !== saved.title)
    choices.push({
      key: 'title',
      label: 'Plan title',
      local: local.title,
      saved: saved.title,
      field: 'title',
    });
  for (const step of saved.items) {
    const previous = local.items.find((item) => item.stableKey === step.stableKey);
    if (!previous || hasProgress(step) || hasProgress(previous)) continue;
    for (const [field, label] of [
      ['clientTitle', 'Client title'],
      ['clientBody', 'Instructions'],
      ['consultantRationale', 'Private rationale'],
    ] as const) {
      if (previous[field] !== step[field])
        choices.push({
          key: `${step.stableKey}:${field}`,
          stepKey: step.stableKey,
          field,
          label: `${step.clientTitle || 'Untitled step'}: ${label}`,
          local: previous[field],
          saved: step[field],
        });
    }
  }
  return choices;
}
export function resolvePlanText(local: PlanDraft, saved: PlanDraft, selected: string[]): PlanDraft {
  const result = structuredClone(saved);
  // Recompute eligibility from the saved snapshot: callers cannot select protected fields.
  for (const choice of conflictChoices(local, saved)) {
    if (!selected.includes(choice.key)) continue;
    if (choice.field === 'title') result.title = local.title;
    else {
      const target = result.items.find((step) => step.stableKey === choice.stepKey)!;
      const source = local.items.find((step) => step.stableKey === choice.stepKey)!;
      if (choice.field === 'clientTitle') target.clientTitle = source.clientTitle;
      else target[choice.field] = source[choice.field];
    }
  }
  return result;
}
export function PlanConflictResolution({
  local,
  saved,
  onResolve,
}: {
  local: PlanDraft;
  saved: PlanDraft;
  onResolve: (draft: PlanDraft) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const choices = conflictChoices(local, saved);
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography variant="h3">Carry selected wording into the saved Plan</Typography>
      <Alert severity="info">
        Start with the saved Plan and choose the wording to keep from your unfinished edits.
        Structure, response forms, sources and recorded progress stay as saved. Steps with recorded
        progress must be revised through the existing review workflow.
      </Alert>
      {choices.map((choice) => (
        <Stack
          key={choice.key}
          spacing={0.5}
          sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={selected.includes(choice.key)}
                onChange={(_, checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, choice.key]
                      : current.filter((key) => key !== choice.key),
                  )
                }
              />
            }
            label={`Keep my ${choice.label}`}
          />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            Your wording: {choice.local || 'Not set'}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            Saved wording: {choice.saved || 'Not set'}
          </Typography>
        </Stack>
      ))}
      {!choices.length && (
        <Typography>
          No eligible wording changes to carry over. Structural changes and steps with progress need
          separate review.
        </Typography>
      )}
      <Button
        variant="contained"
        disabled={!selected.length}
        onClick={() => onResolve(resolvePlanText(local, saved, selected))}
      >
        Use selected wording in a new working copy
      </Button>
      <Typography variant="caption">
        This replaces your current working copy. Unselected edits are discarded. Nothing is saved or
        published until you use Save draft and approve separately.
      </Typography>
    </Stack>
  );
}
