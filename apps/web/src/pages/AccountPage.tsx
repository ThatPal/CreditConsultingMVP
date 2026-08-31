import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export function AccountPage() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
        eyebrow="PORTAL-43"
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
              helperText="Email changes follow a separate verification flow."
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
            <TextField
              name="timezone"
              label="Timezone"
              defaultValue={user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
              required
            />
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
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
