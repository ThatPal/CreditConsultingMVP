import DevicesRounded from '@mui/icons-material/DevicesRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, ApiRequestError } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Session = { id: string; userAgent?: string; createdAt: string; updatedAt: string; expiresAt: string; isCurrent: boolean };

export function describeDevice(userAgent?: string) {
  if (!userAgent) return 'Unknown browser or device';
  const browser = /Edg\//.test(userAgent) ? 'Microsoft Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const device = /Android/.test(userAgent) ? 'Android device' : /iPhone|iPad/.test(userAgent) ? 'Apple mobile device' : /Windows/.test(userAgent) ? 'Windows computer' : /Mac OS/.test(userAgent) ? 'Mac' : /Linux/.test(userAgent) ? 'Linux computer' : 'device';
  return `${browser} on ${device}`;
}

export function SecurityPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<{ kind: 'one'; session: Session } | { kind: 'others' } | { kind: 'current' } | null>(null);
  const [notice, setNotice] = useState('');
  const sessions = useQuery({ queryKey: ['auth-sessions'], queryFn: async () => (await apiRequest<{ sessions: Session[] }>('/api/me/sessions')).sessions, retry: false });
  const blocked = sessions.error instanceof ApiRequestError && sessions.error.status === 403;
  const revoke = useMutation({
    mutationFn: async (target: NonNullable<typeof confirmation>) => {
      if (target.kind === 'current') return logout();
      if (target.kind === 'others') await apiRequest('/api/auth/revoke-other-sessions', { method: 'POST' });
      else await apiRequest(`/api/me/sessions/${target.session.id}`, { method: 'DELETE' });
    },
    onSuccess: async (_value, target) => {
      setConfirmation(null);
      if (target.kind === 'current') { navigate('/login', { replace: true }); return; }
      setNotice(target.kind === 'others' ? 'Other sessions were revoked.' : 'Session revoked.');
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
  });
  const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const nonCurrentCount = sessions.data?.filter((session) => !session.isCurrent).length ?? 0;
  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Security" title="Security & sessions" description="Review signed-in devices, recent activity, and account access." />
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {revoke.isError && <Alert severity="error">{revoke.error instanceof Error ? revoke.error.message : 'The session change failed. Please retry.'}</Alert>}
      <SectionCard>
        <Stack spacing={2}>
          <Box><Typography variant="overline" color="text.secondary">Identity</Typography><Typography sx={{ fontWeight: 800 }}>{user?.email}</Typography></Box>
          {user && user.role !== 'CLIENT' && <Chip label={user.staffMfaVerified ? 'MFA verified' : 'MFA required'} color={user.staffMfaVerified ? 'success' : 'warning'} sx={{ alignSelf: 'flex-start' }} />}
          <Divider />
          <Box><Typography variant="h3">Active sessions</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>End access for a device you no longer recognize or use.</Typography></Box>
          {sessions.isLoading && <Stack aria-label="Loading active sessions"><Skeleton height={112} /><Skeleton height={112} /></Stack>}
          {sessions.isError && <Alert severity={blocked ? 'warning' : 'error'} action={<Button onClick={() => void sessions.refetch()}>Retry</Button>}>{blocked ? 'You are not authorized to view this security information.' : 'Sessions could not be loaded safely.'}</Alert>}
          {sessions.data?.map((session) => (
            <Box key={session.id} sx={{ border: '1px solid', borderColor: session.isCurrent ? 'primary.main' : 'divider', borderRadius: 3, p: 2.25 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                  <DevicesRounded color={session.isCurrent ? 'primary' : 'action'} />
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 850 }}>{describeDevice(session.userAgent)}</Typography>{session.isCurrent && <Chip size="small" color="primary" label="Current session" />}</Stack>
                    <Typography variant="body2" color="text.secondary">Signed in {formatTime(session.createdAt)} · Last active {formatTime(session.updatedAt)}</Typography>
                    <Typography variant="body2" color="text.secondary">Expires {formatTime(session.expiresAt)}</Typography>
                    {session.userAgent && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}>{session.userAgent}</Typography>}
                  </Box>
                </Stack>
                <Button color="error" variant="outlined" startIcon={session.isCurrent ? <LogoutRounded /> : undefined} onClick={() => setConfirmation(session.isCurrent ? { kind: 'current' } : { kind: 'one', session })}>{session.isCurrent ? 'Sign out' : 'Revoke'}</Button>
              </Stack>
            </Box>
          ))}
          {sessions.data?.length === 0 && <Typography color="text.secondary">No active sessions were returned.</Typography>}
          {nonCurrentCount > 0 && <Button color="error" variant="outlined" onClick={() => setConfirmation({ kind: 'others' })} sx={{ alignSelf: 'flex-start' }}>Revoke all other sessions</Button>}
          <Divider /><Button href="/forgot-password" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Reset password</Button>
        </Stack>
      </SectionCard>
      <Dialog open={Boolean(confirmation)} onClose={() => !revoke.isPending && setConfirmation(null)} aria-labelledby="session-confirmation-title">
        <DialogTitle id="session-confirmation-title">{confirmation?.kind === 'current' ? 'Sign out of this session?' : 'Revoke session access?'}</DialogTitle>
        <DialogContent><Typography>{confirmation?.kind === 'current' ? 'You will return to the login screen on this device.' : confirmation?.kind === 'others' ? 'Every other signed-in device will need to authenticate again.' : 'That device will lose access on its next protected request.'}</Typography></DialogContent>
        <DialogActions><Button onClick={() => setConfirmation(null)} disabled={revoke.isPending}>Cancel</Button><Button color="error" variant="contained" onClick={() => confirmation && revoke.mutate(confirmation)} disabled={revoke.isPending}>{revoke.isPending ? 'Working…' : confirmation?.kind === 'current' ? 'Sign out' : 'Revoke access'}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
