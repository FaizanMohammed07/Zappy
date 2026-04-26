import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Wallet, Bell, Star, MapPin, HelpCircle,
  LogOut, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { selectAuth, logout } from '../modules/auth/authSlice';
import { useGetMeQuery } from '../services/api';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';
import { SkeletonProfileHeader, SkeletonList, SkeletonCard } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp } from '../lib/animations';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const nav = useNavigate();
  const dispatch = useDispatch();
  const { profile, role } = useSelector(selectAuth);
  const { data, isLoading } = useGetMeQuery();
  const [showLogout, setShowLogout] = useState(false);

  const user = data?.user || profile;

  function handleLogout() {
    dispatch(logout());
    nav('/login', { replace: true });
    toast.success('Logged out successfully');
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9FAFB] pb-24">
        <header className="page-header">
          <div className="page-header-inner">
            <h1 className="h-card flex-1">Profile</h1>
            <span className="chip-neutral capitalize">{role}</span>
          </div>
        </header>

        {isLoading ? (
          <div className="page-container">
            <SkeletonProfileHeader />
            <div className="pt-5 space-y-4">
              <SkeletonList count={3} Item={SkeletonCard} />
            </div>
          </div>
        ) : (
          <motion.div
            className="page-container lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 lg:pt-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >

            {/* Avatar section */}
            <motion.div
              className="bg-white border-b border-slate-100 lg:border lg:rounded-card lg:shadow-card lg:h-fit px-4 py-6"
              variants={fadeInUp}
            >
              <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3 lg:pb-2">
                <motion.div
                  className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-zappy-gradient flex items-center justify-center text-white text-xl font-bold shrink-0"
                  whileHover={{ scale: 1.05 }}
                >
                  {initials}
                </motion.div>
                <div className="flex-1 min-w-0 lg:flex-none">
                  <h2 className="font-bold text-lg text-[#0F172A] truncate">{user?.name || 'User'}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{user?.phone || user?.email || '—'}</p>
                  {user?.email && user?.phone && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-success-50 px-2 py-1 rounded-full lg:mx-auto">
                  <ShieldCheck size={11} strokeWidth={2.5} className="text-success-600" />
                  <span className="text-[10px] font-bold text-success-700">Verified</span>
                </div>
              </div>
            </motion.div>

            {/* Menu */}
            <div className="px-4 lg:px-0 pt-5 lg:pt-0 space-y-4">
              <motion.div variants={fadeInUp}>
                <MenuSection title="Activity">
                  <MenuItem Icon={ClipboardList} label="My Bookings" sublabel="View order history" onClick={() => nav('/orders')} />
                  <MenuItem Icon={Wallet} label="Wallet" sublabel="Balance & transactions" onClick={() => nav('/wallet')} />
                  <MenuItem Icon={Bell} label="Notifications" onClick={() => nav('/notifications')} />
                </MenuSection>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <MenuSection title="Account">
                  <MenuItem Icon={Star} label="Plans & Subscriptions" sublabel="Premium & Pro benefits" onClick={() => nav('/plans')} />
                  {user?.addresses?.length > 0 && (
                    <MenuItem
                      Icon={MapPin}
                      label="Saved Addresses"
                      sublabel={user.addresses[0]?.label || user.addresses[0]?.address}
                      onClick={() => {}}
                    />
                  )}
                </MenuSection>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <MenuSection title="Help">
                  <MenuItem Icon={HelpCircle} label="Help & Support" sublabel="FAQs & contact us" onClick={() => toast('Opening support…')} />
                </MenuSection>
              </motion.div>

              {/* Logout */}
              <motion.div variants={fadeInUp}>
                <AnimatePresence mode="wait">
                  {!showLogout ? (
                    <motion.button
                      key="logout-btn"
                      onClick={() => setShowLogout(true)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-card bg-white ring-1 ring-red-100 text-red-500 hover:bg-red-50 transition"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                        <LogOut size={16} strokeWidth={2} className="text-red-500" />
                      </div>
                      <span className="font-semibold text-sm flex-1 text-left">Log Out</span>
                    </motion.button>
                  ) : (
                    <motion.div
                      key="logout-confirm"
                      className="card bg-red-50 ring-red-200 space-y-3"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                    >
                      <p className="text-sm font-semibold text-red-800">Are you sure you want to log out?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">Cancel</button>
                        <button onClick={handleLogout} className="btn-danger flex-1">Log Out</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <p className="text-center text-xs text-slate-300 pb-4">
                Zappy Platform · v1.0
              </p>
            </div>
          </motion.div>
        )}

        <BottomNav active="profile" />
      </div>
    </PageTransition>
  );
}

function MenuSection({ title, children }) {
  return (
    <div>
      <p className="section-title px-1">{title}</p>
      <div className="card divide-y divide-slate-100 p-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ Icon, label, sublabel, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition"
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
        <Icon size={16} strokeWidth={2} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5 truncate">{sublabel}</p>}
      </div>
      <ChevronRight size={14} className="text-slate-300 shrink-0" />
    </motion.button>
  );
}
