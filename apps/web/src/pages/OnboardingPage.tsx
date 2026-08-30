import FlagRounded from '@mui/icons-material/FlagRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest, homeFor, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { designTokens } from '../theme';

type GoalDraft = {
  goalType: 'ZERO_APR_CREDIT' | 'TOTAL_AVAILABLE_CREDIT';
  scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
  targetAmount: string;
};
type Orientation = { hasCards: string; hasBusiness: string; reviewedBefore: string };
const defaultGoal: GoalDraft = {
  goalType: 'TOTAL_AVAILABLE_CREDIT',
  scope: 'PERSONAL',
  targetAmount: '50000',
};
const emptyOrientation: Orientation = { hasCards: '0', hasBusiness: '', reviewedBefore: '' };
const steps = ['Your goal', 'Current position', 'Your account', 'Review option'];
function readDraft() {
  try {
    return JSON.parse(localStorage.getItem('credit-onboarding-draft') ?? '{}') as {
      goal?: GoalDraft;
      goals?: GoalDraft[];
      orientation?: Orientation;
      reviewOption?: string;
    };
  } catch {
    return {};
  }
}

export function OnboardingPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [saved] = useState(readDraft);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalDraft>(saved.goal ?? saved.goals?.[0] ?? defaultGoal);
  const [orientation, setOrientation] = useState(saved.orientation ?? emptyOrientation);
  const [account, setAccount] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    termsAccepted: false,
  });
  const [reviewOption, setReviewOption] = useState(saved.reviewOption ?? 'ONE_TIME');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    localStorage.setItem(
      'credit-onboarding-draft',
      JSON.stringify({ goal, orientation, reviewOption }),
    );
  }, [goal, orientation, reviewOption]);
  if (user) return <Navigate to={homeFor(user)} replace />;
  const updateGoal = (input: Partial<GoalDraft>) => setGoal((value) => ({ ...value, ...input }));
  const next = () => {
    setError('');
    if (step === 0 && !(Number(goal.targetAmount) > 0))
      return setError('Enter a target amount greater than zero.');
    if (step === 1 && Object.values(orientation).some((value) => !value))
      return setError('Complete the three orientation questions.');
    setStep((value) => Math.min(3, value + 1));
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ user: CurrentUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...account,
          phone: account.phone.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          goals: [{ ...goal, targetAmount: Number(goal.targetAmount), priority: 'PRIMARY' }],
        }),
      });
      localStorage.removeItem('credit-onboarding-draft');
      localStorage.setItem('credit-review-option', reviewOption);
      await refresh();
      navigate(homeFor(result.user), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2, sm: 4 },
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        background: `radial-gradient(circle at 50% 0%, rgba(66,211,242,.16), transparent 38%), radial-gradient(circle at 12% 78%, rgba(155,120,255,.1), transparent 30%), ${designTokens.gradient.subtle}`,
        '@keyframes ambientDrift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(22px,-16px,0) scale(1.08)' },
        },
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          borderRadius: '50%',
          filter: 'blur(8px)',
          opacity: 0.42,
          pointerEvents: 'none',
          animation: 'ambientDrift 12s ease-in-out infinite',
        },
        '&::before': {
          width: 280,
          height: 280,
          top: '-120px',
          right: '-70px',
          background: 'radial-gradient(circle, rgba(66,211,242,.28), transparent 68%)',
        },
        '&::after': {
          width: 340,
          height: 340,
          bottom: '-170px',
          left: '-100px',
          background: 'radial-gradient(circle, rgba(155,120,255,.24), transparent 68%)',
          animationDelay: '-6s',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before, &::after': { animation: 'none' },
        },
      }}
    >
      <Paper
        sx={{
          width: '100%',
          maxWidth: 920,
          p: { xs: 3, sm: 5 },
          position: 'relative',
          zIndex: 1,
          bgcolor: 'rgba(12, 19, 34, .88)',
          backgroundImage:
            'linear-gradient(145deg, rgba(255,255,255,.035), transparent 35%, rgba(66,211,242,.018))',
          backdropFilter: 'blur(24px)',
          border: `1px solid ${designTokens.color.borderStrong}`,
          boxShadow: `0 28px 90px rgba(0,0,0,.44), 0 0 70px rgba(66,211,242,.055), inset 0 1px rgba(255,255,255,.045)`,
          '& .MuiPaper-outlined': {
            borderColor: 'rgba(145, 184, 213, .2)',
            backgroundImage:
              'linear-gradient(145deg, rgba(26,42,64,.72), rgba(14,23,39,.9) 54%, rgba(24,31,54,.72))',
            boxShadow: 'inset 0 1px rgba(255,255,255,.035), 0 12px 34px rgba(0,0,0,.14)',
            transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
          },
          '& .MuiToggleButton-root': {
            borderColor: 'rgba(145,184,213,.18)',
            transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
          },
          '& .MuiToggleButton-root.Mui-selected': {
            color: 'primary.light',
            borderColor: 'rgba(66,211,242,.55)',
            background: 'linear-gradient(135deg, rgba(66,211,242,.17), rgba(155,120,255,.12))',
            boxShadow: 'inset 0 0 20px rgba(66,211,242,.055), 0 0 18px rgba(66,211,242,.07)',
          },
          '& .MuiSlider-thumb': {
            boxShadow: '0 0 0 5px rgba(66,211,242,.1), 0 0 20px rgba(66,211,242,.38)',
          },
          '& .MuiButton-contained': {
            boxShadow: '0 10px 30px rgba(66,211,242,.18), 0 0 18px rgba(155,120,255,.1)',
            '&:hover': {
              boxShadow: '0 14px 38px rgba(66,211,242,.28), 0 0 24px rgba(155,120,255,.16)',
              transform: 'translateY(-1px)',
            },
          },
          '& .MuiOutlinedInput-root.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(66,211,242,.08), 0 0 22px rgba(66,211,242,.06)',
          },
        }}
      >
        <Stack spacing={3.5}>
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 2,
                  background: designTokens.gradient.brand,
                  color: 'background.default',
                }}
              >
                <FlagRounded />
              </Box>
              <Box>
                <Typography variant="overline" color="primary.main">
                  Future website lead wizard · Step {step + 1} of 4 · {steps[step]}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 850 }}>
                  Credit Strategy
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(step + 1) * 25}
              sx={{ mt: 3, height: 5, borderRadius: 4 }}
            />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {step === 0 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h3" sx={{ maxWidth: 700 }}>
                  How much credit capacity are you building toward?
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Set one clear target. We’ll shape the strategy around it.
                </Typography>
              </Box>
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2.5, sm: 4 }, background: designTokens.gradient.subtle }}
              >
                <Stack spacing={3.5}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="overline" color="text.secondary">
                      Your target
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: 50, sm: 76 },
                        lineHeight: 1,
                        fontWeight: 950,
                        letterSpacing: '-0.06em',
                        color: 'primary.main',
                        my: 1,
                      }}
                    >
                      ${Number(goal.targetAmount || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Slider
                    value={Math.min(Number(goal.targetAmount) || 0, 150000)}
                    onChange={(_event, value) => updateGoal({ targetAmount: String(value) })}
                    min={5000}
                    max={150000}
                    step={5000}
                    marks={[
                      { value: 5000, label: '$5K' },
                      { value: 150000, label: '$150K+' },
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `$${value.toLocaleString()}`}
                    aria-label="Target credit amount"
                    sx={{
                      '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0)' },
                      '& .MuiSlider-markLabel[data-index="1"]': { transform: 'translateX(-100%)' },
                    }}
                  />
                  <TextField
                    label="Enter an exact amount"
                    type="number"
                    value={goal.targetAmount}
                    onChange={(event) => updateGoal({ targetAmount: event.target.value })}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      },
                      htmlInput: { min: 1, max: 100000000 },
                    }}
                  />
                  <Box>
                    <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                      Who is this credit for?
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      value={goal.scope}
                      onChange={(_event, value: GoalDraft['scope'] | null) =>
                        value && updateGoal({ scope: value })
                      }
                      aria-label="Goal scope"
                    >
                      <ToggleButton value="PERSONAL">Personal</ToggleButton>
                      <ToggleButton value="BUSINESS">Business</ToggleButton>
                      <ToggleButton value="BOTH">Both</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.25,
                      borderColor: goal.goalType === 'ZERO_APR_CREDIT' ? 'primary.main' : 'divider',
                      bgcolor:
                        goal.goalType === 'ZERO_APR_CREDIT'
                          ? 'rgba(66,211,242,.06)'
                          : 'transparent',
                    }}
                  >
                    <FormControlLabel
                      sx={{ m: 0, width: '100%', justifyContent: 'space-between', gap: 2 }}
                      labelPlacement="start"
                      label={
                        <Box>
                          <Typography sx={{ fontWeight: 850 }}>Prioritize 0% APR credit</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Focus on promotional purchase capacity.
                          </Typography>
                        </Box>
                      }
                      control={
                        <Switch
                          checked={goal.goalType === 'ZERO_APR_CREDIT'}
                          onChange={(event) =>
                            updateGoal({
                              goalType: event.target.checked
                                ? 'ZERO_APR_CREDIT'
                                : 'TOTAL_AVAILABLE_CREDIT',
                            })
                          }
                        />
                      }
                    />
                  </Paper>
                </Stack>
              </Paper>
              <Button variant="contained" size="large" onClick={next}>
                Build my strategy
              </Button>
            </Stack>
          )}
          {step === 1 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h3">Tell us where you are today</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Three quick signals help personalize the path. This is not a credit assessment.
                </Typography>
              </Box>
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2.5, sm: 3.5 }, background: designTokens.gradient.subtle }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <CreditCardRounded color="primary" />
                    <Box>
                      <Typography sx={{ fontWeight: 850 }}>Cards you currently have</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Include personal and business credit cards.
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        ml: 'auto !important',
                        pl: 2,
                        minWidth: 76,
                        textAlign: 'right',
                        flexShrink: 0,
                        fontSize: 38,
                        fontWeight: 950,
                        color: 'primary.main',
                      }}
                    >
                      {Math.min(
                        Number(orientation.hasCards) || (orientation.hasCards === 'YES' ? 1 : 0),
                        15,
                      ) === 15
                        ? '15+'
                        : Math.min(
                            Number(orientation.hasCards) ||
                              (orientation.hasCards === 'YES' ? 1 : 0),
                            15,
                          )}
                    </Typography>
                  </Stack>
                  <Box sx={{ pb: 1.5 }}>
                    <Slider
                      min={0}
                      max={15}
                      step={1}
                      marks={[
                        { value: 0, label: 'None' },
                        { value: 15, label: '15+' },
                      ]}
                      value={Math.min(
                        Number(orientation.hasCards) || (orientation.hasCards === 'YES' ? 1 : 0),
                        15,
                      )}
                      onChange={(_event, value) =>
                        setOrientation((current) => ({ ...current, hasCards: String(value) }))
                      }
                      aria-label="Number of current credit cards"
                      sx={{
                        '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0)' },
                        '& .MuiSlider-markLabel[data-index="1"]': {
                          transform: 'translateX(-100%)',
                        },
                      }}
                    />
                  </Box>
                </Stack>
              </Paper>
              {(
                [
                  ['hasBusiness', 'Are you building credit for a business?', BusinessCenterRounded],
                  [
                    'reviewedBefore',
                    'Reviewed your full credit profile this year?',
                    FactCheckRounded,
                  ],
                ] as const
              ).map(([key, label, Icon]) => (
                <Paper key={key} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
                    <Icon color="primary" />
                    <Typography sx={{ fontWeight: 850 }}>{label}</Typography>
                  </Stack>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={orientation[key]}
                    onChange={(_event, value: string | null) =>
                      value && setOrientation((current) => ({ ...current, [key]: value }))
                    }
                  >
                    <ToggleButton value="YES">Yes</ToggleButton>
                    <ToggleButton value="NO">No</ToggleButton>
                    <ToggleButton value="UNSURE">Not sure</ToggleButton>
                  </ToggleButtonGroup>
                </Paper>
              ))}
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setStep(0)}>Back</Button>
                <Button variant="contained" onClick={next}>
                  Continue
                </Button>
              </Stack>
            </Stack>
          )}
          {step === 2 && (
            <Stack
              component="form"
              spacing={3}
              onSubmit={(event) => {
                event.preventDefault();
                next();
              }}
            >
              <Box>
                <Typography variant="h3">Create your private workspace</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Save your strategy and continue from any device.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '0.8fr 1.35fr' },
                  gap: 2,
                }}
              >
                <Paper
                  sx={{
                    p: 3,
                    background: designTokens.gradient.brand,
                    color: 'background.default',
                  }}
                >
                  <Stack spacing={3} sx={{ height: '100%' }}>
                    <Box>
                      <Typography variant="overline" sx={{ opacity: 0.72 }}>
                        Your strategy starts here
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 42,
                          lineHeight: 1,
                          fontWeight: 950,
                          letterSpacing: '-0.05em',
                          mt: 1,
                        }}
                      >
                        ${Number(goal.targetAmount).toLocaleString()}
                      </Typography>
                      <Typography sx={{ mt: 1, fontWeight: 750 }}>
                        {goal.scope === 'BOTH'
                          ? 'Personal + business'
                          : goal.scope === 'BUSINESS'
                            ? 'Business'
                            : 'Personal'}{' '}
                        credit target
                      </Typography>
                    </Box>
                    <Stack spacing={1.5} sx={{ mt: 'auto !important' }}>
                      <Stack direction="row" spacing={1.25}>
                        <LockRounded fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Secure, private workspace
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.25}>
                        <VerifiedUserRounded fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          No impact to your credit score
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="First name"
                        autoComplete="given-name"
                        value={account.firstName}
                        onChange={(event) =>
                          setAccount((value) => ({ ...value, firstName: event.target.value }))
                        }
                        required
                        fullWidth
                      />
                      <TextField
                        label="Last name"
                        autoComplete="family-name"
                        value={account.lastName}
                        onChange={(event) =>
                          setAccount((value) => ({ ...value, lastName: event.target.value }))
                        }
                        required
                        fullWidth
                      />
                    </Stack>
                    <TextField
                      label="Email address"
                      type="email"
                      autoComplete="email"
                      value={account.email}
                      onChange={(event) =>
                        setAccount((value) => ({ ...value, email: event.target.value }))
                      }
                      required
                    />
                    <TextField
                      label="Phone (optional)"
                      type="tel"
                      autoComplete="tel"
                      value={account.phone}
                      onChange={(event) =>
                        setAccount((value) => ({ ...value, phone: event.target.value }))
                      }
                    />
                    <TextField
                      label="Create password"
                      type="password"
                      autoComplete="new-password"
                      value={account.password}
                      onChange={(event) =>
                        setAccount((value) => ({ ...value, password: event.target.value }))
                      }
                      helperText="Use at least 12 characters"
                      slotProps={{ htmlInput: { minLength: 12 } }}
                      required
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={account.termsAccepted}
                          onChange={(event) =>
                            setAccount((value) => ({
                              ...value,
                              termsAccepted: event.target.checked,
                            }))
                          }
                          required
                        />
                      }
                      label="I accept the terms and privacy policy"
                    />
                  </Stack>
                </Paper>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" variant="contained">
                  Continue
                </Button>
              </Stack>
            </Stack>
          )}
          {step === 3 && (
            <Stack component="form" spacing={3} onSubmit={submit}>
              <Box>
                <Typography variant="h3">Choose your review rhythm</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Every option includes the same complete consultant-led review. Only the cadence
                  changes.
                </Typography>
              </Box>
              <ToggleButtonGroup
                exclusive
                value={reviewOption}
                onChange={(_event, value: string | null) => value && setReviewOption(value)}
                aria-label="Credit Profile Review cadence"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                  '& .MuiToggleButtonGroup-grouped': {
                    m: 0,
                    borderRadius: '16px !important',
                    border: '1px solid rgba(145,184,213,.2) !important',
                  },
                }}
              >
                {(
                  [
                    [
                      'ONE_TIME',
                      'One-time',
                      'A focused review when you need a fresh strategy.',
                      'No recurring schedule',
                    ],
                    [
                      'SEMIANNUAL',
                      'Every 6 months',
                      'A measured rhythm for long-term credit building.',
                      '2 reviews per year',
                    ],
                    [
                      'QUARTERLY',
                      'Every 3 months',
                      'Stay aligned as balances, cards, and goals evolve.',
                      '4 reviews per year',
                    ],
                    [
                      'MONTHLY',
                      'Monthly',
                      'The closest ongoing review cadence available.',
                      '12 reviews per year',
                    ],
                  ] as const
                ).map(([value, label, description, cadence]) => (
                  <ToggleButton
                    key={value}
                    value={value}
                    sx={{
                      p: 2.5,
                      minHeight: 178,
                      textAlign: 'left',
                      alignItems: 'stretch',
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      position: 'relative',
                      overflow: 'visible',
                    }}
                  >
                    <Stack spacing={1.25} sx={{ width: '100%' }}>
                      <Stack direction="row" sx={{ alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'text.primary' }}>
                          {label}
                        </Typography>
                        {value === 'QUARTERLY' && (
                          <Box
                            sx={{
                              ml: 'auto',
                              px: 1.1,
                              py: 0.45,
                              borderRadius: 5,
                              background: designTokens.gradient.brand,
                              color: 'background.default',
                              fontSize: 11,
                              fontWeight: 900,
                              letterSpacing: '.04em',
                            }}
                          >
                            MOST POPULAR
                          </Box>
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                        {description}
                      </Typography>
                      <Box sx={{ mt: 'auto !important' }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 850 }}>
                          {cadence}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 750 }}>
                          Pricing shown at checkout
                        </Typography>
                      </Box>
                    </Stack>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Every review includes</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 1.25,
                  }}
                >
                  {[
                    'Complete profile review',
                    'Consultant recommendation',
                    'Updated strategy snapshot',
                  ].map((item) => (
                    <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CheckCircleRounded color="primary" fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              </Paper>
              <Alert severity="info">
                Checkout will connect in the commerce sprint. Your selection is saved securely with
                this onboarding session.
              </Alert>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" variant="contained" disabled={busy}>
                  {busy ? 'Creating…' : 'Create my workspace'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
