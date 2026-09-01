import FlagRounded from '@mui/icons-material/FlagRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import RateReviewRounded from '@mui/icons-material/RateReviewRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  InputAdornment,
  Slider,
  Stack,
  Switch,
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
  priority: 'PRIMARY' | 'SECONDARY';
  status: 'ACTIVE' | 'ACHIEVED' | 'PAUSED';
};
const additionalGoalOptions: [GoalType, string, string][] = [
  ['TOTAL_AVAILABLE_CREDIT', 'Increase total available credit', 'Grow overall revolving capacity.'],
  ['BUSINESS_CREDIT', 'Build business credit', 'Expand business credit capacity.'],
  ['PERSONAL_CREDIT', 'Build personal credit', 'Expand personal credit capacity.'],
  [
    'BALANCE_TRANSFER_CAPACITY',
    'Create balance-transfer capacity',
    'Build room for strategic balance transfers.',
  ],
  [
    'EXISTING_LIMIT_INCREASES',
    'Increase existing limits',
    'Focus on credit-limit growth with current issuers.',
  ],
  [
    'REWARDS_POINTS_PORTFOLIO',
    'Build a rewards portfolio',
    'Develop travel, points, or cash-back value.',
  ],
];
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
  const [zeroApr, setZeroApr] = useState(false);
  const [allowAnnualFee, setAllowAnnualFee] = useState(false);
  const [selectedAdditional, setSelectedAdditional] = useState<GoalType[]>([]);
  const [message, setMessage] = useState('');
  const review = reviewQuery.data?.review;
  const reviewComplete = review?.status === 'COMPLETE';
  const reviewInProgress = Boolean(review && !reviewComplete);
  const profileCurrent = reviewComplete && Boolean(profileQuery.data?.profile.freshness.isCurrent);
  useEffect(() => {
    if (primary) {
      setTarget(primary.targetAmount ?? 50000);
      setScope(primary.scope);
      setZeroApr(primary.goalType === 'ZERO_APR_CREDIT');
      setAllowAnnualFee(primary.allowAnnualFee);
    }
  }, [primary]);
  useEffect(() => {
    if (query.data)
      setSelectedAdditional(
        query.data.goals
          .filter((goal) => goal.status === 'ACTIVE' && goal.priority === 'SECONDARY')
          .map((goal) => goal.goalType)
          .filter((type) => type !== 'ZERO_APR_CREDIT'),
      );
  }, [query.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['goals'] });
  const savePrimary = useMutation({
    mutationFn: () =>
      primary
        ? apiRequest(`/api/v1/client/goals/${primary.id}`, {
            method: 'PATCH',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              version: primary.version,
              goalType: zeroApr ? 'ZERO_APR_CREDIT' : 'TOTAL_AVAILABLE_CREDIT',
              scope,
              targetAmount: target,
              allowAnnualFee,
              priority: 'PRIMARY',
            }),
          })
        : apiRequest('/api/v1/client/goals', {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              goalType: zeroApr ? 'ZERO_APR_CREDIT' : 'TOTAL_AVAILABLE_CREDIT',
              scope,
              targetAmount: target,
              allowAnnualFee,
              priority: 'PRIMARY',
            }),
          }),
    onSuccess: async () => {
      await refresh();
      if (cycleId) {
        await apiRequest(`/api/v1/client/application-cycles/${cycleId}/confirm-goal`, {
          method: 'POST',
        });
        await qc.invalidateQueries({ queryKey: ['application-cycles'] });
        navigate('/client/application-rounds');
        return;
      }
      setMessage('Primary goal updated.');
    },
  });
  const saveAdditional = useMutation({
    mutationFn: async () => {
      for (const [goalType] of additionalGoalOptions) {
        const existing = query.data!.goals.find(
          (goal) => goal.goalType === goalType && goal.priority === 'SECONDARY',
        );
        const selected = selectedAdditional.includes(goalType);
        if (selected && !existing)
          await apiRequest('/api/v1/client/goals', {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              goalType,
              scope: 'BOTH',
              targetAmount: null,
              priority: 'SECONDARY',
            }),
          });
        else if (selected && existing && existing.status !== 'ACTIVE')
          await apiRequest(`/api/v1/client/goals/${existing.id}`, {
            method: 'PATCH',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              version: existing.version,
              status: 'ACTIVE',
              priority: 'SECONDARY',
            }),
          });
        else if (!selected && existing?.status === 'ACTIVE')
          await apiRequest(`/api/v1/client/goals/${existing.id}/archive`, {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
          });
      }
    },
    onSuccess: async () => {
      await refresh();
      setMessage('Additional goals updated.');
    },
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load goals.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Strategy"
        title="Goals"
        description="Set your primary target, then select any additional outcomes that matter to you."
      />
      {message && (
        <Alert severity="success" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      <SectionCard variant="elevated">
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
          <Slider
            min={5000}
            max={250000}
            step={5000}
            value={Math.min(target, 250000)}
            onChange={(_, v) => setTarget(v as number)}
            aria-label="Primary goal target"
          />
          <TextField
            label="Exact target"
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              htmlInput: { min: 5000, max: 250000, step: 5000 },
            }}
          />
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={scope}
            onChange={(_, v: Goal['scope'] | null) => v && setScope(v)}
          >
            <ToggleButton value="PERSONAL">Personal</ToggleButton>
            <ToggleButton value="BUSINESS">Business</ToggleButton>
            <ToggleButton value="BOTH">Both</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 850 }}>Prioritize 0% APR credit</Typography>
              <Typography variant="body2" color="text.secondary">
                Make promotional purchase capacity the primary target.
              </Typography>
            </Box>
            <Switch
              sx={{ ml: 'auto' }}
              checked={zeroApr}
              onChange={(e) => setZeroApr(e.target.checked)}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={allowAnnualFee}
                onChange={(event) => setAllowAnnualFee(event.target.checked)}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 850 }}>Allow cards with annual fees</Typography>
                <Typography variant="body2" color="text.secondary">
                  Leave unchecked to consider free cards only.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0 }}
          />
          <Button
            variant="contained"
            onClick={() => savePrimary.mutate()}
            disabled={savePrimary.isPending || target <= 0}
          >
            {savePrimary.isPending
              ? 'Saving…'
              : cycleId
                ? 'Confirm goal for this cycle'
                : 'Save primary goal'}
          </Button>
          {cycleId && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Saving confirms this primary goal and unlocks the next application-cycle step.
            </Typography>
          )}
          {savePrimary.isError && <Alert severity="error">{savePrimary.error.message}</Alert>}
        </Stack>
      </SectionCard>
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
                to={profileCurrent ? '/client/credit-profile' : '/client/credit-profile/review'}
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
      <SectionCard>
        <Typography variant="h2">Additional goals</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Select all that apply. Unchecking an active goal pauses it.
        </Typography>
        <Stack>
          {additionalGoalOptions.map(([id, label, description]) => (
            <FormControlLabel
              key={id}
              sx={{ alignItems: 'flex-start', py: 0.75, mx: 0 }}
              control={
                <Checkbox
                  checked={selectedAdditional.includes(id)}
                  onChange={() =>
                    setSelectedAdditional((current) =>
                      current.includes(id)
                        ? current.filter((type) => type !== id)
                        : [...current, id],
                    )
                  }
                />
              }
              label={
                <Box sx={{ pt: 0.5 }}>
                  <Typography sx={{ fontWeight: 800 }}>{label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Stack>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => saveAdditional.mutate()}
          disabled={saveAdditional.isPending}
        >
          {saveAdditional.isPending ? 'Saving…' : 'Save additional goals'}
        </Button>
        {saveAdditional.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saveAdditional.error.message}
          </Alert>
        )}
      </SectionCard>
    </Stack>
  );
}
