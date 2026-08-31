import { Alert, Box, Button, Chip, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest, ApiRequestError } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Session = {
  id: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export function SecurityPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => (await apiRequest<{ sessions: Session[] }>('/api/me/sessions')).sessions,
    retry: false,
  });
  const blocked = sessions.error instanceof ApiRequestError && sessions.error.status === 403;
  const revokeOthers = async () => {
    await apiRequest('/api/auth/revoke-other-sessions', { method: 'POST' });
    await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Security"
        title="Security & sessions"
        description="Review signed-in devices and protect your account."
      />
      <SectionCard>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Identity
            </Typography>
            <Typography sx={{ fontWeight: 800 }}>{user?.email}</Typography>
          </Box>
          {user && user.role !== 'CLIENT' && (
            <Chip
              label={user.staffMfaVerified ? 'MFA verified' : 'MFA required'}
              color={user.staffMfaVerified ? 'success' : 'warning'}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
          <Divider />
          {sessions.isLoading && (
            <Stack aria-label="Loading active sessions">
              <Skeleton height={54} />
              <Skeleton height={54} />
            </Stack>
          )}
          {sessions.isError && (
            <Alert
              severity={blocked ? 'warning' : 'error'}
              action={<Button onClick={() => void sessions.refetch()}>Retry</Button>}
            >
              {blocked
                ? 'You are not authorized to view this security information.'
                : 'Sessions could not be loaded safely.'}
            </Alert>
          )}
          {sessions.data?.map((session, index) => (
            <Stack
              key={session.id}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ gap: 1, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  {index === 0 ? 'Current session' : 'Signed-in device'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {session.userAgent || 'Unknown browser'}
                </Typography>
              </Box>
            </Stack>
          ))}
          {sessions.data?.length === 0 && (
            <Typography color="text.secondary">No active sessions were returned.</Typography>
          )}
          {(sessions.data?.length ?? 0) > 1 && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => void revokeOthers()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Revoke other sessions
            </Button>
          )}
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button href="/forgot-password" variant="outlined">
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
