import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../modules/auth/authSlice';

export function RequireAuth({ role, children }) {
  const { accessToken, role: currentRole } = useSelector(selectAuth);
  const loc = useLocation();

  if (!accessToken) {
    const loginPath = role === 'worker' ? '/worker/login' : role === 'admin' ? '/admin/login' : '/login';
    return <Navigate to={loginPath} state={{ from: loc.pathname }} replace />;
  }
  if (role && currentRole !== role) {
    // Logged in with wrong role for this route → send to their own home
    const home = currentRole === 'worker' ? '/worker' : currentRole === 'admin' ? '/admin' : '/';
    return <Navigate to={home} replace />;
  }
  return children;
}
