import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import { type PlanDraft } from './editor';

type Difference = { section: string; field: string; local: string; saved: string };
const labels: Record<string, string> = {
  title: 'Plan title',
  purpose: 'Purpose',
  clientTitle: 'Client title',
  clientBody: 'Instructions',
  consultantRationale: 'Private consultant rationale',
  type: 'Type',
  completionMode: 'Completion method',
  owner: 'Next-step owner',
  required: 'Required',
  deepLink: 'Destination',
  outcomeSchema: 'Response form',
  manuallyProtected: 'Protected from automatic changes',
  pathKeys: 'Paths',
  status: 'Progress',
  clientLabel: 'Client label',
  internalLabel: 'Internal label',
  sortOrder: 'Position',
  sourceReviewId: 'Source review',
  sourceReviewVersion: 'Review version',
  sourceGoalRevisionId: 'Goal revision',
  sourceProfileVersion: 'Profile version',
};
const humanize = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
function describe(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(describe).join('\n') : 'None';
  if (typeof value === 'object')
    return (
      Object.entries(value)
        .map(([key, child]) => `${labels[key] ?? humanize(key)}: ${describe(child)}`)
        .join('\n') || 'None'
    );
  return String(value);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => JSON.stringify(key) + ':' + canonical(child))
        .join(',') +
      '}'
    );
  return JSON.stringify(value ?? null);
}
export function comparePlanDrafts(local: PlanDraft, saved: PlanDraft): Difference[] {
  const rows: Difference[] = [];
  const add = (section: string, field: string, left: unknown, right: unknown) => {
    if (canonical(left) !== canonical(right))
      rows.push({ section, field, local: describe(left), saved: describe(right) });
  };
  for (const field of [
    'title',
    'purpose',
    'sourceReviewId',
    'sourceReviewVersion',
    'sourceGoalRevisionId',
    'sourceProfileVersion',
  ] as const)
    add('Plan details', labels[field]!, local[field], saved[field]);
  const stepName = (draft: PlanDraft, key: string) =>
    draft.items.find((step) => step.stableKey === key)?.clientTitle || key;
  const pathName = (draft: PlanDraft, key: string) =>
    draft.paths.find((path) => path.key === key)?.clientLabel || key;
  for (const key of new Set([...local.items, ...saved.items].map((step) => step.stableKey))) {
    const left = local.items.find((step) => step.stableKey === key);
    const right = saved.items.find((step) => step.stableKey === key);
    const section = left?.clientTitle || right?.clientTitle || 'Untitled step';
    add(section, 'Included in Plan', Boolean(left), Boolean(right));
    add(
      section,
      'Position',
      left ? local.items.indexOf(left) + 1 : null,
      right ? saved.items.indexOf(right) + 1 : null,
    );
    for (const field of [
      'clientTitle',
      'clientBody',
      'consultantRationale',
      'type',
      'completionMode',
      'owner',
      'required',
      'deepLink',
      'outcomeSchema',
      'manuallyProtected',
      'status',
    ] as const)
      add(section, labels[field]!, left?.[field], right?.[field]);
    add(
      section,
      'Paths',
      left?.pathKeys.map((path) => pathName(local, path)).sort(),
      right?.pathKeys.map((path) => pathName(saved, path)).sort(),
    );
    const prerequisites = (draft: PlanDraft) =>
      draft.groups
        .filter((group) => group.dependentKey === key)
        .map((group) => ({
          group: group.key,
          rule: group.mode === 'ALL' ? 'All required' : 'Any one required',
          steps: group.prerequisites.map((id) => stepName(draft, id)).sort(),
        }));
    add(section, 'Prerequisites', prerequisites(local), prerequisites(saved));
  }
  for (const key of new Set([...local.paths, ...saved.paths].map((path) => path.key))) {
    const left = local.paths.find((path) => path.key === key),
      right = saved.paths.find((path) => path.key === key);
    const section = `Path: ${left?.clientLabel || right?.clientLabel || key}`;
    add(section, 'Included in Plan', Boolean(left), Boolean(right));
    for (const field of ['clientLabel', 'internalLabel', 'status', 'sortOrder'] as const)
      add(section, labels[field]!, left?.[field], right?.[field]);
  }
  return rows;
}
export function PlanDraftComparison({ local, saved }: { local: PlanDraft; saved: PlanDraft }) {
  const rows = comparePlanDrafts(local, saved);
  return (
    <Stack spacing={2}>
      <Chip label={`${rows.length} differences`} sx={{ alignSelf: 'flex-start' }} />
      {!rows.length && (
        <Typography>
          No content differences. The saved version or progress may have advanced; loading it
          refreshes your editing baseline.
        </Typography>
      )}
      <Stack divider={<Divider />} spacing={2}>
        {rows.map((row, index) => (
          <Box key={index}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
              {row.section} · {row.field}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                mt: 1,
              }}
            >
              {(
                [
                  ['Your unfinished edits', row.local],
                  ['Saved Plan', row.saved],
                ] as const
              ).map(([label, text]) => (
                <Box key={label} sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
