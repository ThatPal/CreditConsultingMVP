import { Alert, Autocomplete, Button, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { ClientContextSections } from './ClientContextSections';

export function AccountPage() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOptions = (() => {
    const supported =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC'];
    return Array.from(
      new Set(
        [...supported, browserTimezone, user?.timezone].filter((value): value is string =>
          Boolean(value),
        ),
      ),
    ).sort();
  })();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      await apiRequest<{ user: CurrentUser }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ ...data, phone: data.phone === '' ? null : data.phone }),
      });
      await refresh();
      setMessage('Profile updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile could not be updated.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Client account"
        title="Account & profile"
        description="Manage your permitted identity and contact details."
      />
      <SectionCard>
        <Stack spacing={3}>
          <Typography variant="h3">Personal details</Typography>
          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <Stack component="form" spacing={2.5} onSubmit={save} sx={{ maxWidth: 560 }}>
            <TextField
              label="Verified email"
              value={user?.email ?? ''}
              disabled
              helperText="This verified sign-in email cannot be changed from the current account tools."
            />
            <TextField
              name="firstName"
              label="First name"
              defaultValue={user?.firstName ?? ''}
              required
            />
            <TextField
              name="lastName"
              label="Last name"
              defaultValue={user?.lastName ?? ''}
              required
            />
            <TextField name="phone" label="Phone" defaultValue={user?.phone ?? ''} />
            <Autocomplete
              options={timezoneOptions}
              defaultValue={user?.timezone ?? browserTimezone}
              autoHighlight
              disableClearable
              renderInput={(params) => (
                <TextField
                  {...params}
                  name="timezone"
                  label="Timezone"
                  helperText={`Browser timezone: ${browserTimezone}`}
                  required
                />
              )}
            />
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={1.5}>
          <Typography variant="h3">Data & privacy</Typography>
          <Typography color="text.secondary">
            Request a copy of your information or ask for an account-data review. Requests are
            verified, tracked, and reviewed against legal, security, payment, and record-retention
            obligations; they are not instant downloads or automatic deletion promises.
          </Typography>
          <Button
            component={Link}
            to="/app/support?new=1&category=ACCOUNT&subject=Data%20%26%20privacy%20request&message=Please%20help%20me%20with%20a%20governed%20data%20or%20privacy%20request."
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            Start a governed request
          </Button>
          <Typography variant="caption" color="text.secondary">
            Your request and every response remain available in Support so you can track progress.
          </Typography>
        </Stack>
      </SectionCard>
      <ClientContextSections />
      <SectionCard>
        <Stack spacing={1.5}>
          <Typography variant="h3">Security</Typography>
          <Typography color="text.secondary">
            Review active devices, revoke other sessions, reset your password, or sign out.
          </Typography>
          <Button
            component={Link}
            to="/app/account/security"
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            Open security & sessions
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
