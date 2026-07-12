import { useState, useEffect } from 'react';

/**
 * Tracks which section is currently near the TOP of the viewport — the same way
 * Swiggy decides which "What's on your mind" item to tick.
 *
 * A single IntersectionObserver with `rootMargin: -20% 0 -70% 0` narrows the
 * detection band to a thin strip 20–30% down from the top. The topmost section
 * (in DOM order) intersecting that band is the active one. `sectionIds` must be
 * a stable reference (module-scoped array) so the observer isn't torn down and
 * rebuilt on every render.
 */
export function useActiveSection(sectionIds) {
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (elements.length === 0) return;

    const visible = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });

        // Topmost section (DOM order) inside the band wins. Only update when we
        // have a match so we never flicker back to null between sections.
        const topmost = sectionIds.find((id) => visible.has(id));
        if (topmost) setActiveSection(topmost);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  // Programmatic jump. Each shelf carries scroll-margin-top so it lands below
  // the header + rail rather than beneath them. Mark active immediately so the
  // rail ticks without waiting for the scroll to settle.
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return { activeSection, scrollToSection };
}
