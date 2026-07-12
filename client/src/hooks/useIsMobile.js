import { useState, useEffect } from 'react';

/**
 * True when the viewport is below Tailwind's `md` breakpoint (768px).
 *
 * Home renders a redesigned mobile experience below this width while keeping the
 * original desktop layout at `md`+ — this hook is the single switch both the page
 * and its sub-components (character grid, promo banners) read so they stay in sync.
 */
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 0.02}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

export default useIsMobile;
