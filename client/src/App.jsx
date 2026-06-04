import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectAuth } from './modules/auth/authSlice';
import { useDisconnectOnLogout } from './hooks/useSocket';
import { useFCM } from './hooks/useFCM.jsx';
import { adminPath } from './config/admin';
import { RequireAuth } from './components/common/RequireAuth';
import NotificationBanner from './components/common/NotificationBanner';

// ── Route-level code splitting ─────────────────────────────────────────────
// Each page is a separate chunk. Browsers only download the chunk for the
// route the user actually visits. Fixes #67 (memory) and #70 (slow browser).
//
// LoginPage is NOT lazy — it's the first screen most users see and needs to
// render immediately with no loading flash.
import LoginPage from './pages/LoginPage';

const HomePage            = lazy(() => import('./pages/HomePage'));
const BookingPage         = lazy(() => import('./pages/BookingPage'));
const OrderTrackingPage   = lazy(() => import('./pages/OrderTrackingPage'));
const OrdersListPage      = lazy(() => import('./pages/OrdersListPage'));
const TrackPage           = lazy(() => import('./pages/TrackPage'));
const ProfilePage         = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage   = lazy(() => import('./pages/NotificationsPage'));
const ChatPage            = lazy(() => import('./pages/ChatPage'));
const ServicesPage        = lazy(() => import('./pages/ServicesPage'));
const WorkerDashboard     = lazy(() => import('./pages/WorkerDashboard'));
const WorkerJobPage       = lazy(() => import('./pages/WorkerJobPage'));
const WorkerKycPage       = lazy(() => import('./pages/WorkerKycPage'));
const AdminDashboard      = lazy(() => import('./pages/AdminDashboard'));
const AdminLoginPage      = lazy(() => import('./pages/AdminLoginPage'));
const PlansPage           = lazy(() => import('./pages/PlansPage'));
const WalletPage          = lazy(() => import('./pages/WalletPage'));
const ReferralPage        = lazy(() => import('./pages/ReferralPage'));
const WorkerProfilePage     = lazy(() => import('./pages/WorkerProfilePage'));
const WorkerEditProfilePage        = lazy(() => import('./pages/WorkerEditProfilePage'));
const WorkerNotificationsPage      = lazy(() => import('./pages/WorkerNotificationsPage'));

// Minimal full-screen spinner shown while a lazy chunk loads.
// Keeps the shell visible so there's no blank white flash on slow connections.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );
}

export default function App() {
  useDisconnectOnLogout();
  useFCM();
  const { accessToken: token, role } = useSelector(selectAuth);
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Show notification permission banner for logged-in users with non-admin roles */}
      {token && role !== 'admin' && <NotificationBanner />}
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
        <Route path="/"       element={<RequireAuth role="user"><HomePage /></RequireAuth>} />
        <Route path="/home"   element={<RequireAuth role="user"><HomePage /></RequireAuth>} />
        <Route path="/services" element={<RequireAuth role="user"><ServicesPage /></RequireAuth>} />
        <Route path="/book/:service" element={<RequireAuth role="user"><BookingPage /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth role="user"><OrdersListPage /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth role="user"><OrderTrackingPage /></RequireAuth>} />
        <Route path="/orders/:id/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
        <Route path="/track"  element={<RequireAuth role="user"><TrackPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth role="user"><ProfilePage /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth role="user"><NotificationsPage /></RequireAuth>} />
        <Route path="/referral" element={<RequireAuth role="user"><ReferralPage /></RequireAuth>} />
        <Route path="/worker-profile/:workerId" element={<RequireAuth role="user"><WorkerProfilePage /></RequireAuth>} />

        {/* Plans + Wallet — available to both users and workers */}
        <Route path="/plans"  element={<RequireAuth><PlansPage /></RequireAuth>} />
        <Route path="/wallet" element={<RequireAuth><WalletPage /></RequireAuth>} />

        {/* Worker app */}
        <Route path="/worker" element={<RequireAuth role="worker"><WorkerDashboard /></RequireAuth>} />
        <Route path="/worker/jobs/:id" element={<RequireAuth role="worker"><WorkerJobPage /></RequireAuth>} />
        <Route path="/worker/kyc" element={<RequireAuth role="worker"><WorkerKycPage /></RequireAuth>} />
        <Route path="/worker/profile" element={<RequireAuth role="worker"><WorkerEditProfilePage /></RequireAuth>} />
        <Route path="/worker/notifications" element={<RequireAuth role="worker"><WorkerNotificationsPage /></RequireAuth>} />

        {/* Admin */}
        <Route
          path={adminPath('/dashboard')}
          element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

function RedirectByRole({ role }) {
  const dest = role === 'worker' ? '/worker' : role === 'admin' ? adminPath('/dashboard') : '/';
  return <Navigate to={dest} replace />;
}
