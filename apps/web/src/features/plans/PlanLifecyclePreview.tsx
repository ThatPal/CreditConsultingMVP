import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { PlanDraft, PlanItem } from './editor';
import { PlanResponsePreview, PlanResponsePreviewProvider } from './PlanResponsePreview';
export function visiblePreviewItems(draft: PlanDraft) {
  const visible = new Set(
    draft.paths
      .filter((path) => ['ACTIVE', 'AVAILABLE'].includes(path.status))
      .map((path) => path.key),
  );
  return draft.items.filter(
    (item) => !item.pathKeys.length || item.pathKeys.some((key) => visible.has(key)),
  );
}
export function previewReadiness(draft: PlanDraft, item: PlanItem, future: boolean) {
  const groups = draft.groups.filter(
    (group) => group.dependentKey === item.stableKey && group.prerequisites.length,
  );
  const rules = groups.map((group) => ({
    key: group.key,
    mode: group.mode,
    steps: group.prerequisites.map((key) => {
      const prerequisite = draft.items.find((step) => step.stableKey === key);
      return {
        key,
        title: prerequisite?.clientTitle || 'Missing prerequisite',
        completed: Boolean(prerequisite && (future || prerequisite.status === 'COMPLETED')),
      };
    }),
  }));
  const satisfied = rules.every((rule) =>
    rule.mode === 'ANY'
      ? rule.steps.some((step) => step.completed)
      : rule.steps.every((step) => step.completed),
  );
  const recorded: Record<string, string> = {
    COMPLETED: 'Completed',
    AWAITING_VERIFICATION: 'Awaiting consultant verification',
    UNABLE: 'Waiting for consultant help',
    CANCELLED: 'Cancelled',
    IN_PROGRESS: 'In progress',
  };
  return {
    rules,
    status: recorded[item.status ?? ''] ?? (satisfied ? 'Ready' : 'Locked'),
    satisfied,
  };
}
export function PlanLifecyclePreview({ draft, clientId }: { draft: PlanDraft; clientId: string }) {
  const [future, setFuture] = useState(false);
  const visible = visiblePreviewItems(draft);
  const hidden = draft.items.length - visible.length;
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        This preview uses the draft's path rules and loaded progress. It does not change the client
        Plan. Readiness shown here assumes the Plan is approved and its sources are current.
      </Alert>
      <FormControlLabel
        control={<Switch checked={future} onChange={(_, checked) => setFuture(checked)} />}
        label="Preview after all prerequisites are completed"
      />
      <Typography variant="body2" role="status">
        {visible.length} visible steps · {hidden} hidden by inactive or retired paths.{' '}
        {future
          ? 'Prerequisite completion is simulated; recorded outcomes remain unchanged.'
          : 'Using currently loaded completion records.'}
      </Typography>
      {draft.paths.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {draft.paths.map((path) => (
            <Chip
              key={path.key}
              label={`${path.clientLabel}: ${path.status.toLowerCase()}`}
              variant="outlined"
            />
          ))}
        </Stack>
      )}
      {!visible.length && (
        <Alert severity="warning">
          No steps are visible with these path settings. Review the paths before approval.
        </Alert>
      )}
      <PlanResponsePreviewProvider clientId={clientId} items={visible} enabled>
        <Stack divider={<Divider />} spacing={3}>
          {visible.map((item) => {
            const projection = previewReadiness(draft, item, future);
            return (
              <Box key={item.stableKey}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="overline">{item.type.toLowerCase()}</Typography>
                  <Chip
                    size="small"
                    label={projection.status}
                    color={projection.status === 'Ready' ? 'success' : 'default'}
                  />
                </Stack>
                <Typography variant="h3">{item.clientTitle || 'Untitled step'}</Typography>
                <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{item.clientBody}</Typography>
                <Typography variant="caption">
                  Owner:{' '}
                  {item.owner === 'CLIENT'
                    ? 'You'
                    : item.owner === 'CONSULTANT'
                      ? 'Your consultant'
                      : 'Automated check'}
                </Typography>
                {projection.rules.map((rule) => (
                  <Box key={rule.key} sx={{ borderLeft: 2, borderColor: 'divider', pl: 2, mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {rule.mode === 'ALL' ? 'Complete all of these' : 'Complete any one of these'}
                    </Typography>
                    <ul>
                      {rule.steps.map((step) => (
                        <li key={step.key}>
                          <Typography variant="body2">
                            {step.title} · {step.completed ? 'Completed' : 'Not completed'}
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                ))}
                {['Ready', 'In progress'].includes(projection.status) ? (
                  <PlanResponsePreview item={item} />
                ) : (
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    No new response is available in this state.
                    {projection.status === 'Locked'
                      ? ' Complete the required earlier steps first.'
                      : ''}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </PlanResponsePreviewProvider>
    </Stack>
  );
}
