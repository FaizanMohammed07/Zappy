import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../modules/auth/authSlice';
import { adminPath } from '../../config/admin';

export function RequireAuth({ role, children }) {
  const { accessToken, role: currentRole } = useSelector(selectAuth);
  const loc = useLocation();

  if (!accessToken) {
    const loginPath = role === 'worker' ? '/worker/login'
      : role === 'admin' ? adminPath('/login')
      : role === 'event_partner' ? '/partner/login'
      : '/login';
    return <Navigate to={loginPath} state={{ from: loc.pathname }} replace />;
  }
  if (role && currentRole !== role) {
    const home = currentRole === 'worker' ? '/worker'
      : currentRole === 'admin' ? adminPath('/dashboard')
      : currentRole === 'event_partner' ? '/partner'
      : '/';
    return <Navigate to={home} replace />;
  }
  return children;
}
