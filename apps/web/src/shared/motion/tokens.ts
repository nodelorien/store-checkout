/**
 * The motion vocabulary. Every animated element takes its timing, curve and distance from here,
 * so the screens move as one product. Only `transform` and `opacity` are ever animated.
 */
export const motion = {
  /** Milliseconds. Interactive feedback stays ≤ 250; entrances ≤ 400; one-off highlights ≤ 600. */
  duration: { feedback: 160, standard: 250, enter: 360, emphasis: 400, highlight: 600 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    linear: 'linear',
  },
  /** Pixels an element rises while it fades in. */
  distance: { rise: 12, nudge: 4 },
  /** Items entering together are offset by `step` ms; from `maxItems` on they share one delay. */
  stagger: { step: 50, maxItems: 6 },
  /** Depth: the deepest layer never travels more than `maxTravel` px. */
  parallax: { maxTravel: 24, heroRange: 320, barRange: 32 },
} as const;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_ALLOWED_QUERY = '@media (prefers-reduced-motion: no-preference)';
/**
 * Clips like `overflow: hidden` without becoming a scroll container. A `view()` timeline tracks
 * the nearest scroll container, so every clipping ancestor of a drifting layer must use this.
 */
export const clipWithoutScrolling = {
  overflow: 'hidden',
  '@supports (overflow: clip)': { overflow: 'clip' },
} as const;

export const SCROLL_TIMELINE_SUPPORT = '@supports (animation-timeline: view())';
