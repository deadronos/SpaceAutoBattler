import { useEffect, useState } from 'react';

/**
 * Hook to detect if the user prefers reduced motion (OS/Browser setting).
 *
 * @returns {boolean} True if reduced motion is preferred.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
    };
  }, []);

  return prefersReduced;
}
