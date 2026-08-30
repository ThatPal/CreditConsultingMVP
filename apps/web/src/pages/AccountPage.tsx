import { Alert, Box, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, type CurrentUser } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export function AccountPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  useEffect(() => setMessage(''), [user]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await apiRequest<{ user: CurrentUser }>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    await refresh();
    setMessage('Profile updated.');
  }
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Account"
        title="Profile & security"
        description="Manage your personal details and session."
      />
      <SectionCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              Profile
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              Personal details
            </Typography>
          </Box>
          {message && <Alert severity="success">{message}</Alert>}
          <Stack component="form" spacing={2.5} onSubmit={save} sx={{ maxWidth: 560 }}>
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
            <Button type="submit" variant="contained">
              Save changes
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              Security
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              Security & session
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: { sm: 'center' } }}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">
                Signed in as
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>{user?.email}</Typography>
            </Box>
            <Chip
              label="Active session"
              color="success"
              size="small"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Stack>
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={Link} to="/forgot-password" variant="outlined">
              Reset password
            </Button>
            <Button
              color="error"
              variant="outlined"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Sign out
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
