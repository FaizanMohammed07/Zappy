import { useState, useEffect, useRef } from 'react';

export function useActiveSection(sectionIds, offset = 140) {
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    // Collect elements
    const elements = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return;

    // We'll track the intersection ratio of all elements
    const visibleElements = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleElements.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleElements.delete(entry.target.id);
          }
        });

        // Find the element with the highest intersection ratio
        let maxRatio = 0;
        let mostVisible = null;

        visibleElements.forEach((ratio, id) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            mostVisible = id;
          }
        });

        if (mostVisible) {
          setActiveSection(mostVisible);
        }
      },
      {
        root: null,
        // Root margin to trigger slightly before/after the middle of the screen
        rootMargin: `-${offset}px 0px -20% 0px`,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );

    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [sectionIds, offset]);

  // Provide a function to programmatically scroll to a section
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // We add scroll-margin-top to the elements in CSS to account for sticky header + rail
    el.scrollIntoView({ behavior: 'smooth' });
    setActiveSection(id);
  };

  return { activeSection, scrollToSection };
}
