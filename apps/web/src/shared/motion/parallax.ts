import { motion } from './tokens';

/** Pure depth maths, shared by the CSS-driven layers and the scroll fallback. */

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Pixels a layer may travel: proportional to its depth (0 = glued to the page, 1 = deepest). */
export function layerTravel(depth: number, maxTravel: number = motion.parallax.maxTravel): number {
  return clamp01(depth) * maxTravel;
}

/**
 * How far an element has crossed the viewport: 0 when its top reaches the bottom edge, 1 when its
 * bottom leaves through the top edge.
 */
export function viewProgress(top: number, height: number, viewportHeight: number): number {
  const distance = viewportHeight + height;
  if (distance <= 0) return 0;
  return clamp01((viewportHeight - top) / distance);
}

/** Offset of a layer crossing the viewport: 0 at the middle, ±`travel` at the edges. */
export function viewOffset(progress: number, travel: number): number {
  return (clamp01(progress) - 0.5) * 2 * travel;
}

/** Offset of a layer tied to the page scroll: 0 at the top, `travel` once `range` px have scrolled. */
export function scrollOffset(scrollY: number, range: number, travel: number): number {
  if (range <= 0) return 0;
  return clamp01(scrollY / range) * travel;
}

/** Delay of the n-th item entering together with its siblings. */
export function staggerDelay(index: number): number {
  const position = Math.min(Math.max(Math.trunc(index), 0), motion.stagger.maxItems - 1);
  return position * motion.stagger.step;
}
