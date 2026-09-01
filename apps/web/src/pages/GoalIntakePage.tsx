import FlagRounded from '@mui/icons-material/FlagRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  InputAdornment,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { designTokens } from '../theme';

type GoalDraft = {
  goalType: 'ZERO_APR_CREDIT' | 'TOTAL_AVAILABLE_CREDIT';
  scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
  targetAmount: number;
  allowAnnualFee: boolean;
};
type Intake = GoalDraft & { version: number; expiresAt: string };
const storageKey = 'credit.goal-intake-token';

export function GoalIntakePage() {
  const [goal, setGoal] = useState<GoalDraft>({
    goalType: 'TOTAL_AVAILABLE_CREDIT',
    scope: 'PERSONAL',
    targetAmount: 50_000,
    allowAnnualFee: false,
  });
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    apiRequest<{ intake: Intake }>(`/api/v1/goal-intakes/${saved}`)
      .then(({ intake }) => {
        setToken(saved);
        setGoal({
          goalType: intake.goalType,
          scope: intake.scope,
          targetAmount: intake.targetAmount,
          allowAnnualFee: intake.allowAnnualFee,
        });
      })
      .catch(() => sessionStorage.removeItem(storageKey));
  }, []);

  async function continueToAccount() {
    setBusy(true);
    setError('');
    try {
      if (token) {
        const current = await apiRequest<{ intake: Intake }>(`/api/v1/goal-intakes/${token}`);
        await apiRequest(`/api/v1/goal-intakes/${token}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...goal, version: current.intake.version }),
        });
      } else {
        const created = await apiRequest<{ token: string }>('/api/v1/goal-intakes', {
          method: 'POST',
          body: JSON.stringify(goal),
        });
        setToken(created.token);
        sessionStorage.setItem(storageKey, created.token);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save your goal');
    } finally {
      setBusy(false);
    }
  }

  const accountQuery = token ? `?intake=${encodeURIComponent(token)}` : '';
  return (
    <Box
      sx={{ minHeight: '100vh', py: { xs: 3, md: 8 }, background: designTokens.gradient.subtle }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              Your outcome comes first
            </Typography>
            <Typography variant="h1" sx={{ mt: 1, maxWidth: 760 }}>
              What would you like your credit capacity to make possible?
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 680 }}>
              Start with a high-level goal. We do not need account numbers, credit-report
              credentials, or sensitive financial details here.
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: designTokens.gradient.brand,
                    color: '#07101f',
                  }}
                >
                  <FlagRounded />
                </Box>
                <Box>
                  <Typography variant="overline" color="primary">
                    Goal-first intake
                  </Typography>
                  <Typography variant="h3">Build available credit</Typography>
                </Box>
              </Stack>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontSize: { xs: 52, sm: 76 },
                    fontWeight: 950,
                    color: 'primary.main',
                    letterSpacing: '-.05em',
                  }}
                >
                  ${goal.targetAmount.toLocaleString()}
                </Typography>
                <Typography color="text.secondary">
                  A planning target—not an approval prediction.
                </Typography>
              </Box>
              <Slider
                min={5_000}
                max={250_000}
                step={5_000}
                value={goal.targetAmount}
                onChange={(_, value) =>
                  setGoal((current) => ({ ...current, targetAmount: value as number }))
                }
                aria-label="Desired credit capacity"
              />
              <TextField
                label="Target amount"
                type="number"
                value={goal.targetAmount}
                onChange={(event) =>
                  setGoal((current) => ({ ...current, targetAmount: Number(event.target.value) }))
                }
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  htmlInput: { min: 5000, max: 250000, step: 5000 },
                }}
              />
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={goal.scope}
                onChange={(_, value: GoalDraft['scope'] | null) =>
                  value && setGoal((current) => ({ ...current, scope: value }))
                }
                aria-label="Goal scope"
              >
                <ToggleButton value="PERSONAL">Personal</ToggleButton>
                <ToggleButton value="BUSINESS">Business</ToggleButton>
                <ToggleButton value="BOTH">Both</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontWeight: 850 }}>Prioritize 0% APR capacity</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Focus this goal on promotional purchase capacity.
                  </Typography>
                </Box>
                <Switch
                  sx={{ ml: 'auto' }}
                  checked={goal.goalType === 'ZERO_APR_CREDIT'}
                  onChange={(event) =>
                    setGoal((current) => ({
                      ...current,
                      goalType: event.target.checked ? 'ZERO_APR_CREDIT' : 'TOTAL_AVAILABLE_CREDIT',
                    }))
                  }
                />
              </Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={goal.allowAnnualFee}
                    onChange={(event) =>
                      setGoal((current) => ({ ...current, allowAnnualFee: event.target.checked }))
                    }
                  />
                }
                label="I am open to options with an annual fee"
              />
              {!token ? (
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => void continueToAccount()}
                  disabled={busy || goal.targetAmount < 5_000 || goal.targetAmount > 250_000}
                >
                  {busy ? 'Saving…' : 'Save goal and continue'}
                </Button>
              ) : (
                <Stack spacing={1.5}>
                  <Alert severity="success">Your goal is saved temporarily for 72 hours.</Alert>
                  <Button
                    component={RouterLink}
                    to={`/register${accountQuery}`}
                    variant="contained"
                    size="large"
                  >
                    Create an account and keep this goal
                  </Button>
                  <Button component={RouterLink} to={`/login${accountQuery}`} variant="outlined">
                    Already a client? Sign in without creating another account
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
