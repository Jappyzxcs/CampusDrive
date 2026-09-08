import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a set of routes (via <Outlet />) and enforces:
 * 1. the visitor is logged in
 * 2. their role is one of `allowedRoles` (when provided)
 *
 * Usage:
 * <Route element={<ProtectedRoute allowedRoles={[ROLES.GUARD]} />}>
 * <Route path={ROUTES.GUARD_DASHBOARD} element={<GuardDashboard />} />
 * </Route>
 */
export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isInitializing, role } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    // Session restore from sessionStorage is near-instant, but guard
    // against a flash-redirect to /login while it resolves.
    return null;
  }

  if (!isAuthenticated) {
    // FIX: Redirect to the Welcome Landing Page ("/") instead of Student Login
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // FIX: Redirect unauthorized users to the Welcome Landing Page ("/")
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}