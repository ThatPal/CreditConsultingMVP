import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState, useRef } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { savedIntakeToken, rememberIntake, forgetIntake } from '../entry/continuation';
import { GoalSummary } from '../entry/EntryComponents';
import { ApiRequestError, apiRequest } from '../auth/api';
import { designTokens } from '../theme';

type OfferPreference = 'ZERO_APR' | 'BALANCE_TRANSFER' | 'REWARDS_POINTS';
type GoalDraft = {
  goalType: 'TOTAL_AVAILABLE_CREDIT';
  scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
  targetAmount: number;
  allowAnnualFee: boolean;
  cardTypePreference:
    'UNSECURED_PREFERRED' | 'OPEN_TO_SECURED' | 'SECURED_DESIRED' | 'NO_PREFERENCE';
  offerPreferences: OfferPreference[];
  feePreference:
    | 'NO_ANNUAL_FEE_ONLY'
    | 'PROMOTIONAL_NO_FEE_ACCEPTABLE'
    | 'PREFER_NO_FEE_OPEN'
    | 'FEE_ACCEPTABLE';
  preferenceNote: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};
type Intake = GoalDraft & { version: number; expiresAt: string };

const initial: GoalDraft = {
  goalType: 'TOTAL_AVAILABLE_CREDIT',
  scope: 'PERSONAL',
  targetAmount: 50_000,
  allowAnnualFee: false,
  cardTypePreference: 'NO_PREFERENCE',
  offerPreferences: [],
  feePreference: 'NO_ANNUAL_FEE_ONLY',
  preferenceNote: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export function GoalIntakePage() {
  const [goal, setGoal] = useState(initial);
  const dirty = useRef(false);
  const [params] = useSearchParams();
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const setSnapshot = (intake: Intake) => {
    setGoal(
      Object.fromEntries(
        Object.keys(initial).map((key) => [
          key,
          intake[key as keyof GoalDraft] ?? initial[key as keyof GoalDraft],
        ]),
      ) as GoalDraft,
    );
    setLoadedVersion(intake.version);
    setExpiresAt(intake.expiresAt);
  };
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  async function reloadSaved() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const { intake } = await apiRequest<{ intake: Intake }>(`/api/v1/goal-intakes/${token}`);
      setSnapshot(intake);
      setStale(false);
      setError('');
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reload the saved goal');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    const saved = params.get('intake') || savedIntakeToken();
    if (!saved) return;
    apiRequest<{ intake: Intake }>(`/api/v1/goal-intakes/${saved}`)
      .then(({ intake }) => {
        if (!active || dirty.current) return;
        setToken(saved);
        setSnapshot(intake);
        setStep(3);
      })
      .catch(() => {
        if (active && !dirty.current) {
          forgetIntake();
          setError('The saved goal could not be restored. You can start a new goal below.');
        }
      });
    return () => {
      active = false;
    };
  }, [params]);

  const toggleOffer = (value: OfferPreference) =>
    setGoal((current) => ({
      ...current,
      offerPreferences: current.offerPreferences.includes(value)
        ? current.offerPreferences.filter((item) => item !== value)
        : [...current.offerPreferences, value],
    }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (token) {
        const updated = await apiRequest<{ intake: Intake }>(`/api/v1/goal-intakes/${token}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...goal, version: loadedVersion }),
        });
        setSnapshot(updated.intake);
      } else {
        const created = await apiRequest<{ token: string; intake: Intake }>(
          '/api/v1/goal-intakes',
          {
            method: 'POST',
            body: JSON.stringify(goal),
          },
        );
        setToken(created.token);
        rememberIntake(created.token);
        setSnapshot(created.intake);
      }
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save your goal');
      setStale(cause instanceof ApiRequestError && cause.status === 409);
    } finally {
      setBusy(false);
    }
  }
  const contactValid =
    goal.firstName.trim() && goal.lastName.trim() && /.+@.+\..+/.test(goal.email);
  const accountQuery = token ? `?intake=${encodeURIComponent(token)}` : '';
  return (
    <Box
      onChangeCapture={() => {
        dirty.current = true;
      }}
      onPointerDownCapture={() => {
        dirty.current = true;
      }}
      sx={{ minHeight: '100vh', py: { xs: 3, md: 7 }, background: designTokens.gradient.subtle }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              Goal-first intake · Step {step} of 3
            </Typography>
            <Typography variant="h1" sx={{ mt: 1 }}>
              Start with what you want credit capacity to make possible.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5 }}>
              This is a planning target, not an approval estimate. Do not enter account numbers or
              credit-report credentials.
            </Typography>
          </Box>
          {error && (
            <Alert severity="error">
              <Stack spacing={1}>
                <Typography>{error}</Typography>
                {stale && (
                  <>
                    <Typography>
                      Your edits are still shown. Reloading replaces them with the saved version so
                      you can review it before saving again.
                    </Typography>
                    <Button disabled={busy} onClick={() => void reloadSaved()}>
                      Discard my edits and review saved version
                    </Button>
                  </>
                )}
              </Stack>
            </Alert>
          )}
          <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}>
            {step === 1 && (
              <Stack spacing={3}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <FlagRounded color="primary" />
                  <Typography variant="h3">Your planning goal</Typography>
                </Stack>
                <Typography
                  sx={{
                    textAlign: 'center',
                    fontSize: { xs: 52, sm: 72 },
                    fontWeight: 950,
                    color: 'primary.main',
                  }}
                >
                  ${goal.targetAmount.toLocaleString()}
                </Typography>
                <Slider
                  min={5_000}
                  max={250_000}
                  step={5_000}
                  value={goal.targetAmount}
                  onChange={(_, value) => setGoal((c) => ({ ...c, targetAmount: value as number }))}
                  aria-label="Goal amount"
                />
                <TextField
                  label="Goal amount"
                  type="number"
                  value={goal.targetAmount}
                  onChange={(e) => setGoal((c) => ({ ...c, targetAmount: Number(e.target.value) }))}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                    htmlInput: { min: 5000, max: 250000 },
                  }}
                />
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={goal.scope}
                  onChange={(_, value) => value && setGoal((c) => ({ ...c, scope: value }))}
                >
                  <ToggleButton value="PERSONAL">Personal</ToggleButton>
                  <ToggleButton value="BUSINESS">Business</ToggleButton>
                  <ToggleButton value="BOTH">Both</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  select
                  label="Card type preference"
                  value={goal.cardTypePreference}
                  onChange={(e) =>
                    setGoal((c) => ({
                      ...c,
                      cardTypePreference: e.target.value as GoalDraft['cardTypePreference'],
                    }))
                  }
                >
                  <MenuItem value="UNSECURED_PREFERRED">Unsecured preferred</MenuItem>
                  <MenuItem value="OPEN_TO_SECURED">Open to secured</MenuItem>
                  <MenuItem value="SECURED_DESIRED">Secured specifically desired</MenuItem>
                  <MenuItem value="NO_PREFERENCE">No preference</MenuItem>
                </TextField>
                <FormControl>
                  <FormLabel>Offer preferences</FormLabel>
                  <Stack>
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
                            checked={goal.offerPreferences.includes(value)}
                            onChange={() => toggleOffer(value)}
                          />
                        }
                        label={label}
                      />
                    ))}
                  </Stack>
                </FormControl>
                <TextField
                  select
                  label="Fee preference"
                  value={goal.feePreference}
                  onChange={(e) =>
                    setGoal((c) => ({
                      ...c,
                      feePreference: e.target.value as GoalDraft['feePreference'],
                      allowAnnualFee: e.target.value !== 'NO_ANNUAL_FEE_ONLY',
                    }))
                  }
                >
                  <MenuItem value="NO_ANNUAL_FEE_ONLY">No annual fee only</MenuItem>
                  <MenuItem value="PROMOTIONAL_NO_FEE_ACCEPTABLE">
                    Promotional / first-year no fee acceptable
                  </MenuItem>
                  <MenuItem value="PREFER_NO_FEE_OPEN">Prefer no fee, but open</MenuItem>
                  <MenuItem value="FEE_ACCEPTABLE">Annual fee acceptable</MenuItem>
                </TextField>
                <TextField
                  label="Additional card preference (optional)"
                  multiline
                  minRows={2}
                  value={goal.preferenceNote}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  onChange={(e) => setGoal((c) => ({ ...c, preferenceNote: e.target.value }))}
                />
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => setStep(2)}
                  disabled={
                    !Number.isInteger(goal.targetAmount) ||
                    goal.targetAmount < 5000 ||
                    goal.targetAmount > 250000
                  }
                >
                  Continue
                </Button>
              </Stack>
            )}
            {step === 2 && (
              <Stack spacing={2.5}>
                <Typography variant="h3">How should we identify your saved goal?</Typography>
                <Typography color="text.secondary">
                  We use only this minimum contact information to carry your goal into account
                  creation. No account is created yet.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    required
                    fullWidth
                    label="First name"
                    value={goal.firstName}
                    onChange={(e) => setGoal((c) => ({ ...c, firstName: e.target.value }))}
                  />
                  <TextField
                    required
                    fullWidth
                    label="Last name"
                    value={goal.lastName}
                    onChange={(e) => setGoal((c) => ({ ...c, lastName: e.target.value }))}
                  />
                </Stack>
                <TextField
                  required
                  type="email"
                  label="Email"
                  value={goal.email}
                  onChange={(e) => setGoal((c) => ({ ...c, email: e.target.value }))}
                />
                <TextField
                  label="Phone (optional)"
                  value={goal.phone}
                  onChange={(e) => setGoal((c) => ({ ...c, phone: e.target.value }))}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void save()}
                    disabled={busy || stale || !contactValid}
                  >
                    {busy ? 'Saving…' : 'Save and continue securely'}
                  </Button>
                </Stack>
              </Stack>
            )}
            {step === 3 && (
              <Stack spacing={1.5}>
                <Alert severity="success">
                  Your goal is saved until {new Date(expiresAt).toLocaleString()}. No account Goal
                  has been changed.
                </Alert>
                <GoalSummary values={goal} />
                <Button
                  component={RouterLink}
                  target="_top"
                  to={`/register${accountQuery}`}
                  variant="contained"
                  size="large"
                >
                  Create an account
                </Button>
                <Button
                  component={RouterLink}
                  target="_top"
                  to={`/login${accountQuery}`}
                  variant="outlined"
                >
                  Already a client? Sign in without creating another account
                </Button>
                <Button onClick={() => setStep(1)}>Review or edit goal</Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
