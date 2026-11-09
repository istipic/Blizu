import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from './anim/clock';

/**
 * Fades `[data-reveal]` children of `root` in when they scroll into view. Without IntersectionObserver
 * or with reduced motion nothing is hidden, so the content never depends on the animation.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    el.classList.add('na-reveal-on');
    el.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      el.classList.remove('na-reveal-on');
    };
  }, [root]);
}
