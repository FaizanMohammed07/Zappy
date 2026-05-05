import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectAuth } from './modules/auth/authSlice';
import { useDisconnectOnLogout } from './hooks/useSocket';
import { useFCM } from './hooks/useFCM';

import { adminPath } from './config/admin';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import OrdersListPage from './pages/OrdersListPage';
import TrackPage from './pages/TrackPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import ChatPage from './pages/ChatPage';
import ServicesPage from './pages/ServicesPage';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerJobPage from './pages/WorkerJobPage';
import WorkerKycPage from './pages/WorkerKycPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import PlansPage from './pages/PlansPage';
import WalletPage from './pages/WalletPage';
import { RequireAuth } from './components/common/RequireAuth';

export default function App() {
  useDisconnectOnLogout();
  useFCM();
  const { accessToken: token, role } = useSelector(selectAuth);
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
    <Routes location={location} key={location.pathname}>
      {/* Public */}
      <Route path="/login" element={token ? <RedirectByRole role={role} /> : <LoginPage role="user" />} />
      <Route
        path="/worker/login"
        element={token ? <RedirectByRole role={role} /> : <LoginPage role="worker" />}
      />
      <Route
        path={adminPath('/login')}
        element={token ? <RedirectByRole role={role} /> : <AdminLoginPage />}
      />

      {/* User app */}
      <Route
        path="/"
        element={
          <RequireAuth role="user">
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/home"
        element={
          <RequireAuth role="user">
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/services"
        element={
          <RequireAuth role="user">
            <ServicesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/book/:service"
        element={
          <RequireAuth role="user">
            <BookingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/orders"
        element={
          <RequireAuth role="user">
            <OrdersListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <RequireAuth role="user">
            <OrderTrackingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/orders/:id/chat"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />

      <Route
        path="/track"
        element={
          <RequireAuth role="user">
            <TrackPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth role="user">
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequireAuth role="user">
            <NotificationsPage />
          </RequireAuth>
        }
      />

      {/* Plans + Wallet — available to both users and workers */}
      <Route
        path="/plans"
        element={
          <RequireAuth>
            <PlansPage />
          </RequireAuth>
        }
      />
      <Route
        path="/wallet"
        element={
          <RequireAuth>
            <WalletPage />
          </RequireAuth>
        }
      />

      {/* Worker app */}
      <Route
        path="/worker"
        element={
          <RequireAuth role="worker">
            <WorkerDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/worker/jobs/:id"
        element={
          <RequireAuth role="worker">
            <WorkerJobPage />
          </RequireAuth>
        }
      />
      <Route
        path="/worker/kyc"
        element={
          <RequireAuth role="worker">
            <WorkerKycPage />
          </RequireAuth>
        }
      />

      {/* Admin */}
      <Route
        path={adminPath('/dashboard')}
        element={
          <RequireAuth role="admin">
            <AdminDashboard />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AnimatePresence>
  );
}

function RedirectByRole({ role }) {
  const dest = role === 'worker' ? '/worker' : role === 'admin' ? adminPath('/dashboard') : '/';
  return <Navigate to={dest} replace />;
}
