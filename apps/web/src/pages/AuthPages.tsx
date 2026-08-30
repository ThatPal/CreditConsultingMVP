import LockRounded from '@mui/icons-material/LockRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, homeFor, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { designTokens } from '../theme';

function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: designTokens.gradient.subtle,
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 480, p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Box>
            <Box
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                mb: 2,
                background: designTokens.gradient.brand,
                color: 'background.default',
              }}
            >
              <LockRounded />
            </Box>
            <Typography variant="h4">{title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          </Box>
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}

export function LoginPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ user: CurrentUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      await refresh();
      navigate(homeFor(result.user), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to your private credit strategy workspace.">
      <Stack component="form" spacing={2} onSubmit={submit}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField name="email" label="Email" type="email" autoComplete="email" required />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Link component={RouterLink} to="/forgot-password">
            Forgot password?
          </Link>
          <Link component={RouterLink} to="/register">
            Create account
          </Link>
        </Stack>
      </Stack>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await apiRequest<{ user: CurrentUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...data, termsAccepted: data.termsAccepted === 'on' }),
      });
      await refresh();
      navigate(homeFor(result.user), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Create your account"
      subtitle="Register directly for secure access to the client portal."
    >
      <Stack component="form" spacing={2} onSubmit={submit}>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField name="firstName" label="First name" required />
          <TextField name="lastName" label="Last name" required />
        </Stack>
        <TextField name="email" label="Email" type="email" required />
        <TextField name="phone" label="Phone (optional)" />
        <TextField
          name="password"
          label="Password"
          type="password"
          helperText="Use at least 12 characters"
          slotProps={{ htmlInput: { minLength: 12 } }}
          required
        />
        <input
          type="hidden"
          name="timezone"
          value={Intl.DateTimeFormat().resolvedOptions().timeZone}
        />
        <FormControlLabel
          control={<Checkbox name="termsAccepted" required />}
          label="I accept the terms and privacy policy"
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
        <Link component={RouterLink} to="/login">
          Already have an account? Sign in
        </Link>
      </Stack>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    try {
      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit request');
    }
  }
  return (
    <AuthFrame
      title="Reset your password"
      subtitle="We’ll send instructions if the account is eligible."
    >
      {sent ? (
        <Alert severity="success">Check your email for reset instructions.</Alert>
      ) : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField name="email" label="Email" type="email" required />
          <Button type="submit" variant="contained">
            Send reset link
          </Button>
        </Stack>
      )}
      <Link component={RouterLink} to="/login">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: params.get('token'), password }),
      });
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset password');
    }
  }
  return (
    <AuthFrame
      title="Choose a new password"
      subtitle="Your other signed-in sessions will be closed."
    >
      <Stack component="form" spacing={2} onSubmit={submit}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          name="password"
          label="New password"
          type="password"
          slotProps={{ htmlInput: { minLength: 12 } }}
          required
        />
        <Button type="submit" variant="contained">
          Update password
        </Button>
      </Stack>
    </AuthFrame>
  );
}

export function ConsultantAccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Stack spacing={3}>
      <Typography variant="h2">Consultant account</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography sx={{ fontWeight: 800 }}>{user?.email}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.role === 'ADMIN' ? 'Administrator access' : 'Consultant access'}
        </Typography>
        <Button
          color="error"
          variant="outlined"
          sx={{ mt: 3 }}
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </Button>
      </Paper>
    </Stack>
  );
}
