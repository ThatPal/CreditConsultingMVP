import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from '../components/common/Feedback';
import { homeFor } from './api';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ roles }: { roles: Array<'CLIENT' | 'CONSULTANT' | 'ADMIN'> }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSkeleton />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
