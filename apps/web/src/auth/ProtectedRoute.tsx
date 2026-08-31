import { Alert, Button, Stack } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from '../components/common/Feedback';
import { homeFor } from './api';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ roles }: { roles: Array<'CLIENT' | 'CONSULTANT' | 'ADMIN'> }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <Stack sx={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert severity="error" action={<Button onClick={() => void refresh()}>Retry</Button>}>
          We couldn’t load your secure workspace. Your session has not been changed.
        </Alert>
      </Stack>
    );
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  if (user.role !== 'CLIENT' && !user.staffMfaVerified)
    return (
      <Navigate to={`/mfa?mode=enroll&returnTo=${encodeURIComponent(location.pathname)}`} replace />
    );
  return <Outlet />;
}
