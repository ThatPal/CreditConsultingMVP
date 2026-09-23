import { useEffect, useRef } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type {
  EntryGoalValues,
  IntakePreview,
  GoalResolutionReference,
  PendingIntake,
} from '@credit/shared';

const label = (value: string) => value.toLowerCase().replaceAll('_', ' ');
export function GoalSummary({
  values,
  density = 'FULL',
  title = 'Saved goal',
  showType = true,
}: {
  values: EntryGoalValues;
  density?: 'COMPACT' | 'FULL';
  title?: string;
  showType?: boolean;
}) {
  const rows = [
    ...(showType ? [['Goal type', label(values.goalType)]] : []),
    ['Scope', label(values.scope)],
    [
      'Target',
      values.targetAmount === null ? 'Not specified' : `$${values.targetAmount.toLocaleString()}`,
    ],
    ['Annual fee allowed', values.allowAnnualFee ? 'Yes' : 'No'],
    ['Card preference', label(values.cardTypePreference)],
    [
      'Offers',
      values.offerPreferences.length
        ? values.offerPreferences.map(label).join(', ')
        : 'No preference',
    ],
    ['Fee preference', label(values.feePreference)],
    ['Additional preference', values.preferenceNote || 'None specified'],
  ];
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns:
            density === 'COMPACT'
              ? 'minmax(95px, .8fr) minmax(0, 1.2fr)'
              : { xs: '1fr', sm: 'minmax(120px, .8fr) minmax(0, 1.2fr)' },
          gap: 1,
        }}
      >
        {rows.map(([name, value]) => (
          <Box key={name} sx={{ display: 'contents' }}>
            <Typography component="dt" color="text.secondary" variant="body2">
              {name}
            </Typography>
            <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
export function EntryIntentStrip({
  summary,
  expiresAt,
  state,
  onReview,
}: {
  summary?: EntryGoalValues;
  expiresAt?: string;
  state: 'SAVED' | 'UNAVAILABLE';
  onReview?: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="overline">Optional saved goal</Typography>
        {state === 'SAVED' && summary ? (
          <>
            <GoalSummary values={summary} density="COMPACT" />
            <Typography variant="body2">
              Saved until {new Date(expiresAt!).toLocaleString()}. Creating an account does not
              apply this goal. You choose after signing in.
            </Typography>
          </>
        ) : (
          <Typography>This saved goal is unavailable. You can continue without it.</Typography>
        )}
        {onReview && <Button onClick={onReview}>Review saved goal</Button>}
      </Stack>
    </Paper>
  );
}
export function GoalIntakeDecision({
  preview,
  account,
  commandState,
  onResolve,
  onNotNow,
  onRefresh,
  onViewGoals,
}: {
  preview: IntakePreview;
  account: string;
  commandState: 'IDLE' | 'SUBMITTING' | 'CONFLICT' | 'ERROR' | 'RESOLVED';
  onResolve: (decision: 'APPLY_SAVED' | 'KEEP_CURRENT') => void;
  onNotNow: () => void;
  onRefresh: () => void;
  onViewGoals: () => void;
}) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h2">Choose what to do with your saved goal</Typography>
          <Typography color="text.secondary">
            Signed in as {account}. Your choice affects this account only.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {preview.currentGoal ? (
            <GoalSummary title="Current goal" values={preview.currentGoal} />
          ) : (
            <Typography>No current primary goal is saved.</Typography>
          )}
          <GoalSummary values={preview.savedGoal} />
        </Box>
        {preview.state === 'TARGET_CONFLICT' ? (
          <Alert severity="warning">
            A different Goal type or scope already occupies this target. Keep your current goal or
            manage your Goals before applying it.
          </Alert>
        ) : (
          <Typography>
            {preview.state === 'MATCHING'
              ? 'The saved and current goal match. Confirmation will not change your Goal.'
              : preview.state === 'NO_PRIMARY'
                ? 'This saved goal becomes your primary goal only if you confirm.'
                : `${preview.differences.length} goal ${preview.differences.length === 1 ? 'field differs' : 'fields differ'}.`}
          </Typography>
        )}
        {preview.currentGoal && preview.differences.length > 0 && (
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {preview.differences.map((d) => (
              <Typography component="li" key={d.field} sx={{ overflowWrap: 'anywhere' }}>
                {label(d.field.replace(/([A-Z])/g, '_$1'))}:{' '}
                {Array.isArray(d.before)
                  ? d.before.map(String).join(', ') || 'None'
                  : String(d.before ?? 'Not specified')}{' '}
                →{' '}
                {Array.isArray(d.after)
                  ? d.after.map(String).join(', ') || 'None'
                  : String(d.after ?? 'Not specified')}
              </Typography>
            ))}
          </Box>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {preview.decisions
            .filter((d) => d.enabled)
            .map((d) => (
              <Button
                key={d.decision}
                variant={d.decision === 'APPLY_SAVED' ? 'contained' : 'outlined'}
                disabled={commandState !== 'IDLE'}
                onClick={() => onResolve(d.decision)}
              >
                {d.decision === 'KEEP_CURRENT'
                  ? 'Keep current goal'
                  : preview.state === 'NO_PRIMARY'
                    ? 'Save this goal'
                    : preview.state === 'MATCHING'
                      ? 'Confirm saved goal'
                      : 'Use saved goal'}
              </Button>
            ))}
          {preview.state === 'TARGET_CONFLICT' && (
            <Button onClick={onViewGoals} disabled={commandState !== 'IDLE'}>
              View Goals
            </Button>
          )}
          <Button onClick={onRefresh} disabled={commandState !== 'IDLE'}>
            Refresh comparison
          </Button>
          <Button disabled={commandState !== 'IDLE'} onClick={onNotNow}>
            Not now
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
export type EntryRecoveryKind =
  | 'UNAVAILABLE'
  | 'EXPIRED'
  | 'STALE'
  | 'ALREADY_RESOLVED'
  | 'LEGACY_OUTCOME_UNAVAILABLE'
  | 'AUTH_FAILURE'
  | 'SIGNED_IN_RECOVERY';
export function EntryRecovery({
  kind,
  message,
  actions,
  requestState,
}: {
  kind: EntryRecoveryKind;
  message: string;
  actions: { retry?: () => void; back?: () => void; continueWithout: () => void };
  requestState: 'IDLE' | 'BUSY';
}) {
  const focus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focus.current?.focus();
  }, [kind, message]);
  return (
    <Alert severity="warning" ref={focus} tabIndex={-1}>
      <Stack spacing={1}>
        <Typography>{message}</Typography>
        {actions.retry && (
          <Button disabled={requestState === 'BUSY'} onClick={actions.retry}>
            {kind === 'STALE' ? 'Refresh comparison' : 'Retry'}
          </Button>
        )}
        {actions.back && <Button onClick={actions.back}>Back to saved goal</Button>}
        <Button onClick={actions.continueWithout}>Continue without this saved goal</Button>
      </Stack>
    </Alert>
  );
}
export function PendingIntakeList({
  entries,
  onSelect,
}: {
  entries: PendingIntake[];
  onSelect: (id: string) => void;
}) {
  if (!entries.length) return null;
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h2">Saved goals awaiting your decision</Typography>
        {entries.map((entry) => (
          <Box key={entry.claimId}>
            <GoalSummary values={entry.goalSummary} density="COMPACT" />
            <Typography variant="body2">
              Saved until {new Date(entry.expiresAt).toLocaleString()}
            </Typography>
            <Button onClick={() => onSelect(entry.claimId)}>Compare this saved goal</Button>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
export function GoalResolutionFeedback({
  resolution,
  onContinue,
}: {
  resolution: GoalResolutionReference;
  onContinue: () => void;
}) {
  return (
    <Alert severity="success">
      <Typography>
        {resolution.effect === 'KEPT'
          ? 'Your current goal was kept.'
          : resolution.effect === 'UNCHANGED'
            ? 'Your matching goal was confirmed.'
            : 'Your saved goal was applied.'}
      </Typography>
      <Typography variant="body2">
        Recorded {new Date(resolution.resolvedAt).toLocaleString()} · Goal version{' '}
        {resolution.goalVersion}. Your current Goal may have changed since this decision.
      </Typography>
      <Button onClick={onContinue}>Continue</Button>
    </Alert>
  );
}
