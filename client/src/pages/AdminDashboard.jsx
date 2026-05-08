import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Users, Briefcase, Tag,
  Wallet, Scale, CreditCard, BarChart2, Gift, XCircle,
  FileText, LogOut, Menu, X, ChevronRight, FileCheck, Crown,
} from 'lucide-react';
import { logout } from '../modules/auth/authSlice';
import { adminPath } from '../config/admin';

import Overview from './admin/Overview';
import Orders from './admin/Orders';
import AdminUsers from './admin/Users';
import Workers from './admin/Workers';
import Pricing from './admin/Pricing';
import AdminWallet from './admin/Wallet';
import Disputes from './admin/Disputes';
import Payouts from './admin/Payouts';
import Analytics from './admin/Analytics';
import Incentives from './admin/Incentives';
import Cancellation from './admin/Cancellation';
import Audit from './admin/Audit';
import AdminKycReview from './AdminKycReview';
import AdminPlans from './admin/Plans';

const NAV = [
  { id: 'overview',     label: 'Overview',        icon: LayoutDashboard },
  { id: 'orders',       label: 'Orders',           icon: ShoppingBag },
  { id: 'users',        label: 'Users',            icon: Users },
  { id: 'workers',      label: 'Workers',          icon: Briefcase },
  { id: 'kyc',          label: 'KYC',              icon: FileCheck },
  { id: 'pricing',      label: 'Pricing',          icon: Tag },
  { id: 'plans',        label: 'Subscr. Plans',    icon: Crown },
  { id: 'wallet',       label: 'Wallet',           icon: Wallet },
  { id: 'disputes',     label: 'Disputes',         icon: Scale },
  { id: 'payouts',      label: 'Payouts',          icon: CreditCard },
  { id: 'analytics',    label: 'Analytics',        icon: BarChart2 },
  { id: 'incentives',   label: 'Incentives',       icon: Gift },
  { id: 'cancellation', label: 'Cancellation',     icon: XCircle },
  { id: 'audit',        label: 'Audit Logs',       icon: FileText },
];

const SECTION_MAP = {
  overview:     Overview,
  orders:       Orders,
  users:        AdminUsers,
  workers:      Workers,
  kyc:          AdminKycReview,
  pricing:      Pricing,
  wallet:       AdminWallet,
  disputes:     Disputes,
  payouts:      Payouts,
  analytics:    Analytics,
  incentives:   Incentives,
  cancellation: Cancellation,
  audit:        Audit,
  plans:        AdminPlans,
};

export default function AdminDashboard() {
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const Section = SECTION_MAP[active] || Overview;

  const handleNav = useCallback((id) => {
    setActive(id);
    setSidebarOpen(false);
  }, []);

  function logout() {
    dispatch(logout());
    navigate(adminPath('/login'), { replace: true });
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-slate-900 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">Z</span>
            </div>
            <span className="text-white font-bold text-base tracking-tight">Zappy Admin</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                  transition-all mb-0.5 text-left group
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                `}>
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={12} className="text-blue-300" />}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-600">
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-bold text-slate-800">
            {NAV.find(n => n.id === active)?.label || 'Dashboard'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-bold text-xs">A</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Section />
        </main>
      </div>
    </div>
  );
}
