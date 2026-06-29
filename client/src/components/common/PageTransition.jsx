import { motion } from 'framer-motion';
import { useLayoutEffect } from 'react';
import { pageVariants, pageTransition } from '../../lib/animations';

export default function PageTransition({ children, className = '' }) {
  useLayoutEffect(() => {
    // useLayoutEffect runs synchronously immediately after the new page mounts, 
    // but BEFORE the browser paints it to the screen. 
    // This ensures zero flicker and instant scroll reset.
    
    // Reset all standard scrolling containers
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Reset React root in case it is acting as the scroll container
    const root = document.getElementById('root');
    if (root) root.scrollTop = 0;
  }, []);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
