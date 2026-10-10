import useMediaQuery from '@mui/material/useMediaQuery';
import { REDUCED_MOTION_QUERY } from './tokens';

/** True when the customer asked the system to reduce motion. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY, { noSsr: true });
}

/** Native scroll-driven animation: the depth effect then runs in CSS, off the main thread. */
export function supportsScrollTimeline(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('animation-timeline: view()')
    : false;
}

export function supportsViewportObserver(): boolean {
  return typeof IntersectionObserver === 'function';
}

export type ParallaxMode = 'off' | 'native' | 'fallback';

/** How depth is driven here: not at all, by CSS, or by the scroll fallback. */
export function useParallaxMode(): ParallaxMode {
  const reduced = useReducedMotion();
  if (reduced) return 'off';
  return supportsScrollTimeline() ? 'native' : 'fallback';
}
