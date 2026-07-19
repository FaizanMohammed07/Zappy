import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './BottomNav';
import InstallPrompt from '../pwa/InstallPrompt';

export default function MainLayout() {
  const location = useLocation();
  return (
    <div className="app-shell flex flex-col min-h-[100dvh]">
      <main 
        className="app-content flex-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} className="h-full">
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <InstallPrompt />
      <BottomNav />
    </div>
  );
}
