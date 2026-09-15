import { useNavigationProtection } from '../NavigationProtection';
import FlagRounded from '@mui/icons-material/FlagRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import RateReviewRounded from '@mui/icons-material/RateReviewRounded';
import {
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { designTokens } from '../theme';
import {
  ArchetypeCanvas,
  ProgressArc,
  ProvenanceDetails,
} from '../components/common/ProductFoundation';

type GoalType =
  | 'ZERO_APR_CREDIT'
  | 'TOTAL_AVAILABLE_CREDIT'
  | 'BUSINESS_CREDIT'
  | 'PERSONAL_CREDIT'
  | 'BALANCE_TRANSFER_CAPACITY'
  | 'EXISTING_LIMIT_INCREASES'
  | 'REWARDS_POINTS_PORTFOLIO';
type Goal = {
  id: string;
  version: number;
  goalType: GoalType;
  scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
  targetAmount: number | null;
  currentAmount: number | null;
  allowAnnualFee: boolean;
  cardTypePreference:
    'UNSECURED_PREFERRED' | 'OPEN_TO_SECURED' | 'SECURED_DESIRED' | 'NO_PREFERENCE';
  offerPreferences: ('ZERO_APR' | 'BALANCE_TRANSFER' | 'REWARDS_POINTS')[];
  feePreference:
    | 'NO_ANNUAL_FEE_ONLY'
    | 'PROMOTIONAL_NO_FEE_ACCEPTABLE'
    | 'PREFER_NO_FEE_OPEN'
    | 'FEE_ACCEPTABLE';
  preferenceNote: string | null;
  priority: 'PRIMARY' | 'SECONDARY';
  status: 'ACTIVE' | 'ACHIEVED' | 'PAUSED';
};
export function GoalsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cycleId = searchParams.get('cycle');
  const query = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiRequest<{ goals: Goal[] }>('/api/v1/client/goals'),
  });
  const reviewQuery = useQuery({
    queryKey: ['review', 'client'],
    queryFn: () =>
      apiRequest<{ review: { id: string; status: string; completedAt: string | null } | null }>(
        '/api/v1/reviews/client',
      ),
    retry: false,
  });
  const profileQuery = useQuery({
    queryKey: ['credit-profile'],
    queryFn: () =>
      apiRequest<{
        profile: {
          freshness: { asOf: string | null; expiresAt: string | null; isCurrent: boolean };
        };
      }>('/api/v1/client/credit-profile'),
    retry: false,
  });
  const active = query.data?.goals.filter((g) => g.status === 'ACTIVE') ?? [];
  const primary = active.find((g) => g.priority === 'PRIMARY') ?? active[0];
  const [target, setTarget] = useState(50000);
  const [scope, setScope] = useState<Goal['scope']>('PERSONAL');
  const [cardTypePreference, setCardTypePreference] =
    useState<Goal['cardTypePreference']>('NO_PREFERENCE');
  const [offerPreferences, setOfferPreferences] = useState<Goal['offerPreferences']>([]);
  const [feePreference, setFeePreference] = useState<Goal['feePreference']>('NO_ANNUAL_FEE_ONLY');
  const [preferenceNote, setPreferenceNote] = useState('');
  const [message, setMessage] = useState('');
  const review = reviewQuery.data?.review;
  const reviewComplete = review?.status === 'COMPLETE';
  const reviewInProgress = Boolean(review && !reviewComplete);
  const profileCurrent = reviewComplete && Boolean(profileQuery.data?.profile.freshness.isCurrent);
  const [reviewedGoal, setReviewedGoal] = useState<Goal | null | undefined>(undefined);
  const [baseline, setBaseline] = useState('');
  const [confirmReload, setConfirmReload] = useState(false);
  const [continueCycle, setContinueCycle] = useState(false);
  const formValue = JSON.stringify({
    target,
    scope,
    cardTypePreference,
    offerPreferences,
    feePreference,
    preferenceNote,
  });
  const dirty = reviewedGoal !== undefined && formValue !== baseline;
  const changed =
    reviewedGoal !== undefined &&
    (reviewedGoal?.id !== primary?.id || reviewedGoal?.version !== primary?.version);
  const loadGoal = (goal: Goal | null) => {
    const fields = {
      target: goal?.targetAmount ?? 50000,
      scope: goal?.scope ?? ('PERSONAL' as Goal['scope']),
      cardTypePreference:
        goal?.cardTypePreference ?? ('NO_PREFERENCE' as Goal['cardTypePreference']),
      offerPreferences: goal?.offerPreferences ?? [],
      feePreference: goal?.feePreference ?? ('NO_ANNUAL_FEE_ONLY' as Goal['feePreference']),
      preferenceNote: goal?.preferenceNote ?? '',
    };
    setTarget(fields.target);
    setScope(fields.scope);
    setCardTypePreference(fields.cardTypePreference);
    setOfferPreferences(fields.offerPreferences);
    setFeePreference(fields.feePreference);
    setPreferenceNote(fields.preferenceNote);
    setBaseline(JSON.stringify(fields));
    setReviewedGoal(goal);
  };
  useEffect(() => {
    if (query.data && reviewedGoal === undefined) loadGoal(primary ?? null);
  }, [query.data, primary, reviewedGoal]);
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError) throw result.error;
    const activeGoals = result.data?.goals.filter((goal) => goal.status === 'ACTIVE') ?? [];
    return activeGoals.find((goal) => goal.priority === 'PRIMARY') ?? activeGoals[0] ?? null;
  };
  const savePrimary = useMutation({
    mutationFn: () =>
      reviewedGoal
        ? apiRequest(`/api/v1/client/goals/${reviewedGoal.id}`, {
            method: 'PATCH',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              version: reviewedGoal.version,
              scope,
              targetAmount: target,
              allowAnnualFee: feePreference !== 'NO_ANNUAL_FEE_ONLY',
              cardTypePreference,
              offerPreferences,
              feePreference,
              preferenceNote: preferenceNote || null,
            }),
          })
        : apiRequest('/api/v1/client/goals', {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              goalType: 'TOTAL_AVAILABLE_CREDIT',
              scope,
              targetAmount: target,
              allowAnnualFee: feePreference !== 'NO_ANNUAL_FEE_ONLY',
              cardTypePreference,
              offerPreferences,
              feePreference,
              preferenceNote: preferenceNote || null,
              priority: 'PRIMARY',
            }),
          }),
    onSuccess: async () => {
      loadGoal(await refresh());
      if (cycleId) {
        await apiRequest(`/api/v1/client/application-cycles/${cycleId}/confirm-goal`, {
          method: 'POST',
        });
        await qc.invalidateQueries({ queryKey: ['application-cycles'] });
        setContinueCycle(true);
        return;
      }
      setMessage('Primary goal updated.');
    },
  });
  useNavigationProtection(dirty, savePrimary.isPending);
  useEffect(() => {
    if (continueCycle && !savePrimary.isPending && !dirty) navigate('/app/application-rounds');
  }, [continueCycle, savePrimary.isPending, dirty, navigate]);
  useEffect(() => {
    if (!dirty && !savePrimary.isPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, savePrimary.isPending]);
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError && reviewedGoal === undefined)
    return (
      <Alert severity="error">
        Unable to load goals. <Button onClick={() => void query.refetch()}>Retry goals</Button>
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Strategy"
        title="Goals"
        description="Set your primary target, then select any additional outcomes that matter to you."
      />
      {query.isError && (
        <Alert severity="error">
          Goals could not be refreshed. Your edits are still here.{' '}
          <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
            Retry goals
          </Button>
        </Alert>
      )}
      {changed && (
        <Alert severity="warning">
          The saved goal changed while this editor was open. Your edits are still here. Review the
          latest saved values before saving again.
          <Button
            disabled={savePrimary.isPending || query.isFetching || query.isError}
            onClick={() => setConfirmReload(true)}
          >
            Review saved goal
          </Button>
        </Alert>
      )}
      {dirty && (
        <Alert severity="info">
          You have unsaved goal changes. Save them before leaving this page.
        </Alert>
      )}
      <Dialog
        open={confirmReload}
        onClose={() => setConfirmReload(false)}
        aria-labelledby="goal-reload-title"
      >
        <DialogTitle id="goal-reload-title">Load the latest saved goal?</DialogTitle>
        <DialogContent>
          Your current edits will be replaced by the latest saved values. Keep editing if you need
          to copy your wording first.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReload(false)}>Keep my edits</Button>
          <Button
            disabled={query.isFetching || query.isError || savePrimary.isPending}
            onClick={() => {
              loadGoal(primary ?? null);
              setConfirmReload(false);
              savePrimary.reset();
              setMessage('Latest saved goal loaded.');
            }}
          >
            Load saved goal
          </Button>
        </DialogActions>
      </Dialog>
      {message && (
        <Alert severity="success" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      <ArchetypeCanvas archetype="financial-dashboard" role="client">
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: designTokens.gradient.brand,
                color: 'background.default',
              }}
            >
              <FlagRounded />
            </Box>
            <Box>
              <Typography variant="overline" color="primary">
                Primary goal
              </Typography>
              <Typography variant="h3">Build available credit</Typography>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ alignItems: 'center', justifyContent: 'center' }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                sx={{
                  fontSize: { xs: 54, sm: 76 },
                  lineHeight: 1,
                  fontWeight: 950,
                  color: 'primary.main',
                  letterSpacing: '-.055em',
                }}
              >
                ${target.toLocaleString()}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {scope === 'BOTH'
                  ? 'Personal + business'
                  : scope === 'BUSINESS'
                    ? 'Business'
                    : 'Personal'}{' '}
                capacity
              </Typography>
            </Box>
            {primary?.currentAmount != null && primary.targetAmount && primary.targetAmount > 0 && (
              <ProgressArc
                value={(primary.currentAmount / primary.targetAmount) * 100}
                label="Factual goal progress"
              />
            )}
          </Stack>
          {primary?.currentAmount != null && (
            <ProvenanceDetails
              source="Saved goal progress"
              method="Current amount divided by the saved target amount. This is not an approval probability or projected score change."
            />
          )}
          <Box
            component="fieldset"
            disabled={savePrimary.isPending}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
            <Stack spacing={2}>
              <Slider
                disabled={savePrimary.isPending}
                min={5000}
                max={250000}
                step={5000}
                value={Math.min(target, 250000)}
                onChange={(_, v) => setTarget(v as number)}
                aria-label="Primary goal target"
              />
              <TextField
                disabled={savePrimary.isPending}
                label="Exact target"
                error={!Number.isInteger(target) || target < 5000 || target > 250000}
                helperText="Enter a whole-dollar amount from $5,000 to $250,000."
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  htmlInput: { min: 5000, max: 250000, step: 5000 },
                }}
              />
              <ToggleButtonGroup
                disabled={savePrimary.isPending}
                exclusive
                fullWidth
                value={scope}
                onChange={(_, v: Goal['scope'] | null) => v && setScope(v)}
              >
                <ToggleButton value="PERSONAL">Personal</ToggleButton>
                <ToggleButton value="BUSINESS">Business</ToggleButton>
                <ToggleButton value="BOTH">Both</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                disabled={savePrimary.isPending}
                select
                label="Card type preference"
                value={cardTypePreference}
                onChange={(event) =>
                  setCardTypePreference(event.target.value as Goal['cardTypePreference'])
                }
              >
                <MenuItem value="UNSECURED_PREFERRED">Unsecured preferred</MenuItem>
                <MenuItem value="OPEN_TO_SECURED">Open to secured</MenuItem>
                <MenuItem value="SECURED_DESIRED">Secured specifically desired</MenuItem>
                <MenuItem value="NO_PREFERENCE">No preference</MenuItem>
              </TextField>
              <Box>
                <Typography sx={{ fontWeight: 850 }}>Offer preferences</Typography>
                {(
                  [
                    ['ZERO_APR', '0% APR'],
                    ['BALANCE_TRANSFER', 'Balance transfer'],
                    ['REWARDS_POINTS', 'Rewards / points'],
                  ] as const
                ).map(([value, label]) => (
                  <FormControlLabel
                    key={value}
                    control={
                      <Checkbox
                        disabled={savePrimary.isPending}
                        checked={offerPreferences.includes(value)}
                        onChange={() =>
                          setOfferPreferences((current) =>
                            current.includes(value)
                              ? current.filter((item) => item !== value)
                              : [...current, value],
                          )
                        }
                      />
                    }
                    label={label}
                  />
                ))}
              </Box>
              <TextField
                disabled={savePrimary.isPending}
                select
                label="Fee preference"
                value={feePreference}
                onChange={(event) => setFeePreference(event.target.value as Goal['feePreference'])}
              >
                <MenuItem value="NO_ANNUAL_FEE_ONLY">No annual fee only</MenuItem>
                <MenuItem value="PROMOTIONAL_NO_FEE_ACCEPTABLE">
                  Promotional / first-year no fee acceptable
                </MenuItem>
                <MenuItem value="PREFER_NO_FEE_OPEN">Prefer no fee, but open</MenuItem>
                <MenuItem value="FEE_ACCEPTABLE">Annual fee acceptable</MenuItem>
              </TextField>
              <TextField
                disabled={savePrimary.isPending}
                label="Additional card preference (optional)"
                multiline
                minRows={2}
                value={preferenceNote}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                onChange={(event) => setPreferenceNote(event.target.value)}
              />
              <Button
                variant="contained"
                onClick={() => savePrimary.mutate()}
                disabled={
                  savePrimary.isPending ||
                  query.isFetching ||
                  query.isError ||
                  changed ||
                  reviewedGoal === undefined ||
                  !Number.isInteger(target) ||
                  target < 5000 ||
                  target > 250000
                }
              >
                {savePrimary.isPending
                  ? 'Saving…'
                  : cycleId
                    ? 'Confirm goal for this cycle'
                    : 'Save primary goal'}
              </Button>
            </Stack>
          </Box>
          {primary && (
            <Alert severity="info">
              Changing this goal may require your consultant to review downstream Plan or Strategy
              work. Existing published history will remain preserved.
            </Alert>
          )}
          {cycleId && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Saving confirms this primary goal and unlocks the next application-cycle step.
            </Typography>
          )}
          {savePrimary.isError && <Alert severity="error">{savePrimary.error.message}</Alert>}
        </Stack>
      </ArchetypeCanvas>
      <SectionCard
        variant="elevated"
        sx={{
          borderColor: profileCurrent
            ? 'rgba(66, 230, 164, .45)'
            : reviewInProgress
              ? 'rgba(255, 179, 77, .45)'
              : 'rgba(69, 215, 240, .45)',
        }}
      >
        {reviewQuery.isLoading || profileQuery.isLoading ? (
          <LoadingSkeleton />
        ) : (
          <Grid container spacing={2.5} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    flex: '0 0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 2,
                    color: profileCurrent
                      ? '#42e6a4'
                      : reviewInProgress
                        ? '#ffb34d'
                        : 'primary.main',
                    bgcolor: profileCurrent
                      ? 'rgba(66, 230, 164, .1)'
                      : reviewInProgress
                        ? 'rgba(255, 179, 77, .1)'
                        : 'rgba(69, 215, 240, .1)',
                    border: '1px solid currentColor',
                  }}
                >
                  {profileCurrent ? (
                    <CheckCircleRounded />
                  ) : reviewInProgress ? (
                    <HourglassTopRounded />
                  ) : (
                    <RateReviewRounded />
                  )}
                </Box>
                <Box>
                  <Typography variant="overline" color="primary">
                    Begin working on your goal
                  </Typography>
                  <Typography variant="h2" sx={{ mt: 0.35 }}>
                    {profileCurrent
                      ? 'Your Credit Profile Review is complete'
                      : reviewInProgress
                        ? 'Your Credit Profile Review is in progress'
                        : reviewComplete
                          ? 'Your Credit Profile needs an update'
                          : 'Start with a Credit Profile Review'}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                    {profileCurrent
                      ? 'Your verified Credit Profile now provides the foundation for consultant readiness decisions and the next steps toward this goal.'
                      : reviewInProgress
                        ? 'Continue the Review process. Your goal strategy will update after your consultant completes the Review.'
                        : reviewComplete
                          ? 'Your previous Review is no longer current. Complete an updated Review before advancing this goal.'
                          : 'A Credit Profile Review establishes the verified facts your consultant needs to begin planning work toward this goal.'}
                  </Typography>
                  {reviewComplete && review?.completedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      Review completed {new Date(review.completedAt).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button
                component={Link}
                to={profileCurrent ? '/app/credit-center' : '/app/credit-center/review'}
                variant="contained"
                fullWidth
              >
                {profileCurrent
                  ? 'View Credit Profile'
                  : reviewInProgress
                    ? 'Continue Review'
                    : reviewComplete
                      ? 'Update Credit Profile'
                      : 'Start Credit Profile Review'}
              </Button>
            </Grid>
          </Grid>
        )}
      </SectionCard>
    </Stack>
  );
}
