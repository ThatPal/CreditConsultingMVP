import LockRounded from '@mui/icons-material/LockRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
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
import { QRCodeSVG } from 'qrcode.react';
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { apiRequest, homeFor, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { safeReturnPath } from '../auth/safeReturnPath';
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
  const location = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const intakeToken = params.get('intake');
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    try {
      const signIn = await apiRequest<{ twoFactorRedirect?: boolean }>('/api/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email, password: data.get('password') }),
      });
      const returnTo = safeReturnPath((location.state as { from?: unknown } | null)?.from, '/crm');
      if (signIn.twoFactorRedirect) {
        navigate(`/mfa?mode=challenge&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }
      await refresh();
      const result = await apiRequest<{ user: CurrentUser }>('/api/me');
      if (result.user.role === 'CLIENT' && intakeToken) {
        await apiRequest(`/api/v1/client/goal-intakes/${encodeURIComponent(intakeToken)}/bind`, {
          method: 'POST',
        });
        sessionStorage.removeItem('credit.goal-intake-token');
      }
      if (result.user.role !== 'CLIENT' && !result.user.staffMfaVerified) {
        navigate(`/mfa?mode=enroll&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }
      navigate(
        safeReturnPath(
          (location.state as { from?: unknown } | null)?.from,
          result.user.role === 'CLIENT' && intakeToken ? '/app/goals' : homeFor(result.user),
        ),
        { replace: true },
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to sign in';
      setError(message);
      if (/verif/i.test(message)) setVerificationEmail(email);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to your private credit strategy workspace.">
      <Stack component="form" spacing={2} onSubmit={submit}>
        {params.get('verified') === '1' && (
          <Alert severity="success">Email verified. You can sign in now.</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {resendState === 'success' && (
          <Alert severity="success">
            If the account is eligible, a new verification email has been sent.
          </Alert>
        )}
        {resendState === 'error' && (
          <Alert severity="error">The verification email could not be sent. Please retry.</Alert>
        )}
        {verificationEmail && (
          <Button
            variant="outlined"
            disabled={resendState === 'busy'}
            onClick={async () => {
              setResendState('busy');
              try {
                await apiRequest('/api/auth/send-verification-email', {
                  method: 'POST',
                  body: JSON.stringify({
                    email: verificationEmail,
                    callbackURL: '/verify-email?status=success',
                  }),
                });
                setResendState('success');
              } catch {
                setResendState('error');
              }
            }}
          >
            {resendState === 'busy' ? 'Sending…' : 'Resend verification email'}
          </Button>
        )}
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

export function StaffMfaPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'enroll' ? 'enroll' : 'challenge';
  const returnTo = safeReturnPath(params.get('returnTo'), '/crm');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const setupKey = (() => {
    if (!totpURI) return '';
    try {
      return new URL(totpURI).searchParams.get('secret') ?? '';
    } catch {
      return '';
    }
  })();

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  }

  async function cancelSetup() {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out');
      setBusy(false);
    }
  }

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const password = new FormData(event.currentTarget).get('password');
      const result = await apiRequest<{ totpURI: string; backupCodes: string[] }>(
        '/api/auth/two-factor/enable',
        {
          method: 'POST',
          body: JSON.stringify({ password, issuer: 'Credit Consulting' }),
        },
      );
      setTotpURI(result.totpURI);
      setBackupCodes(result.backupCodes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to begin setup');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const code = new FormData(event.currentTarget).get('code');
      await apiRequest('/api/auth/two-factor/verify-totp', {
        method: 'POST',
        body: JSON.stringify({ code, trustDevice: false }),
      });
      await refresh();
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code could not be verified');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'enroll' && !user) return <Navigate to="/login" replace />;
  if (mode === 'enroll' && user?.role === 'CLIENT') return <Navigate to={homeFor(user)} replace />;
  return (
    <AuthFrame
      title={mode === 'enroll' ? 'Protect your staff account' : 'Verify it’s you'}
      subtitle={
        mode === 'enroll'
          ? 'Staff accounts require an authenticator code before accessing client information.'
          : 'Enter the current six-digit code from your authenticator app.'
      }
    >
      {error && (
        <Alert severity="error" role="alert">
          {error} You can retry or contact support for recovery.
        </Alert>
      )}
      {mode === 'enroll' && !totpURI ? (
        <Stack component="form" spacing={2} onSubmit={beginEnrollment}>
          <TextField
            name="password"
            label="Confirm password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Preparing…' : 'Set up authenticator'}
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          {totpURI && (
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="h3">Scan with your authenticator app</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  In Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app,
                  choose Add account and scan this code.
                </Typography>
              </Box>
              <Box
                sx={{
                  alignSelf: 'center',
                  bgcolor: '#fff',
                  p: 2,
                  borderRadius: 2,
                  boxShadow: '0 18px 50px rgba(0,0,0,.28)',
                }}
              >
                <QRCodeSVG
                  value={totpURI}
                  size={220}
                  level="M"
                  marginSize={1}
                  title="Authenticator setup QR code"
                />
              </Box>
              <Button variant="text" onClick={() => setManualOpen((value) => !value)}>
                {manualOpen ? 'Hide manual setup' : 'Can’t scan? Use a setup key'}
              </Button>
              {manualOpen && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography sx={{ fontWeight: 850 }}>Manual authenticator setup</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Choose “Enter a setup key,” use account type Time based, and enter this key.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label="Setup key"
                        value={setupKey}
                        fullWidth
                        slotProps={{
                          htmlInput: { readOnly: true, 'aria-label': 'Manual setup key' },
                        }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyRounded />}
                        onClick={() => void copyValue('Setup key', setupKey)}
                      >
                        Copy key
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {copied && <Alert severity="success">{copied} copied.</Alert>}
            </Stack>
          )}
          {backupCodes.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 800 }}>Save these recovery codes now</Typography>
              <Typography variant="body2" color="text.secondary">
                Each code can be used once. They will not be shown again.
              </Typography>
              <Box component="ul" aria-label="Recovery codes">
                {backupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyRounded />}
                onClick={() => void copyValue('Recovery codes', backupCodes.join('\n'))}
              >
                Copy recovery codes
              </Button>
            </Paper>
          )}
          <Stack component="form" spacing={2} onSubmit={verify}>
            <TextField
              name="code"
              label="Six-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus={mode === 'challenge'}
              slotProps={{ htmlInput: { pattern: '[0-9]{6}', maxLength: 6 } }}
            />
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify and continue'}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Lost your authenticator? Contact support to use the governed account-recovery process.
          </Typography>
        </Stack>
      )}
      <Button
        variant="text"
        color="inherit"
        startIcon={<LogoutRounded />}
        disabled={busy}
        onClick={() => void cancelSetup()}
      >
        {mode === 'enroll' ? 'Cancel setup and sign out' : 'Sign out'}
      </Button>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const intakeToken = params.get('intake');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await apiRequest('/api/auth/sign-up/email', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
          authFirstName: data.firstName,
          authLastName: data.lastName,
          authPhone: data.phone || undefined,
          authTimezone: data.timezone,
          authTermsAccepted: data.termsAccepted === 'on',
          authGoalIntakeToken: intakeToken || undefined,
          callbackURL: '/verify-email?status=success',
        }),
      });
      if (intakeToken) sessionStorage.removeItem('credit.goal-intake-token');
      navigate('/verify-email', { replace: true, state: { email: String(data.email ?? '') } });
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

export function VerifyEmailPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const stateEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(stateEmail);
  const [status, setStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const result = params.get('status');
  const verificationFailed = result === 'expired' || result === 'invalid' || params.has('error');
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('busy');
    try {
      await apiRequest('/api/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email, callbackURL: '/verify-email?status=success' }),
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }
  return (
    <AuthFrame
      title={result === 'success' ? 'Email verified' : 'Verify your email'}
      subtitle={
        result === 'success'
          ? 'Your secure account is ready for sign in.'
          : 'Open the private verification link sent to your inbox.'
      }
    >
      <Stack spacing={2.5}>
        {result === 'success' ? (
          <Alert severity="success">Verification complete. Continue to sign in.</Alert>
        ) : verificationFailed ? (
          <Alert severity="warning">
            This verification link is no longer valid. Request a new link below.
          </Alert>
        ) : (
          <Alert severity="info">
            Check your inbox. For security, the link can expire or be used only once.
          </Alert>
        )}
        {result !== 'success' && (
          <Stack component="form" spacing={2} onSubmit={resend}>
            {status === 'success' && (
              <Alert severity="success">
                If the account is eligible, a new verification email has been sent.
              </Alert>
            )}
            {status === 'error' && (
              <Alert severity="error">We could not send the email. Please retry.</Alert>
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button type="submit" variant="outlined" disabled={status === 'busy'}>
              {status === 'busy' ? 'Sending…' : 'Resend verification email'}
            </Button>
          </Stack>
        )}
        <Button
          component={RouterLink}
          to="/login"
          variant={result === 'success' ? 'contained' : 'text'}
        >
          Return to sign in
        </Button>
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
      await apiRequest('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email, redirectTo: '/reset-password' }),
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
  const token = params.get('token');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      navigate('/login?reset=1', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset password');
    }
  }
  return (
    <AuthFrame
      title="Choose a new password"
      subtitle="Your other signed-in sessions will be closed."
    >
      {!token || params.has('error') ? (
        <Alert severity="error">
          This reset link is invalid or expired.{' '}
          <Link component={RouterLink} to="/forgot-password">
            Request a new link
          </Link>
          .
        </Alert>
      ) : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && (
            <Alert severity="error">
              {error}{' '}
              <Link component={RouterLink} to="/forgot-password">
                Request a new link
              </Link>
              .
            </Alert>
          )}
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
      )}
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
