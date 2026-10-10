import Box, { type BoxProps } from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';
import { useRef, type CSSProperties } from 'react';
import { useParallaxMode } from './environment';
import { scrollOffset, viewOffset, viewProgress } from './parallax';
import { useScrollFrame } from './scrollFrames';
import { MOTION_ALLOWED_QUERY, SCROLL_TIMELINE_SUPPORT, motion } from './tokens';

const drift = keyframes({
  from: { transform: 'translate3d(0, var(--parallax-from), 0)' },
  to: { transform: 'translate3d(0, var(--parallax-to), 0)' },
});

interface ParallaxLayerProps extends Omit<BoxProps, 'ref'> {
  /** Pixels the layer drifts; keep it within the margin by which the layer overfills its frame. */
  travel: number;
  /**
   * `view`: tied to the frame crossing the viewport (0 at the middle, ±travel at the edges).
   * `scroll`: tied to the page scroll (0 at the top, +travel after `range` px).
   */
  timeline?: 'view' | 'scroll';
  range?: number;
}

/**
 * A layer that drifts vertically with the scroll to suggest depth. CSS drives it where the browser
 * has scroll-driven animation; elsewhere the shared scroll fallback does. Still when motion is reduced.
 */
export function ParallaxLayer({
  travel,
  timeline = 'view',
  range = motion.parallax.heroRange,
  sx,
  style,
  children,
  ...boxProps
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useParallaxMode();
  const inView = timeline === 'view';
  // The two ends of the drift, read by the keyframes.
  const driftEnds = {
    '--parallax-from': inView ? `${-travel}px` : '0px',
    '--parallax-to': `${travel}px`,
  };

  useScrollFrame(({ scrollY, viewportHeight }) => {
    const layer = ref.current;
    if (!layer) return;
    let offset = scrollOffset(scrollY, range, travel);
    if (inView) {
      // Measure the frame, not the layer: the layer is the element being moved.
      const frame = (layer.parentElement ?? layer).getBoundingClientRect();
      offset = viewOffset(viewProgress(frame.top, frame.height, viewportHeight), travel);
    }
    layer.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
  }, mode === 'fallback');

  return (
    <Box
      ref={ref}
      data-parallax={mode}
      {...boxProps}
      style={{ ...style, ...driftEnds } as CSSProperties}
      sx={[
        mode !== 'off' && {
          [MOTION_ALLOWED_QUERY]: {
            [SCROLL_TIMELINE_SUPPORT]: {
              willChange: 'transform',
              // The shorthand resets the timeline, so the timeline is declared after it.
              animation: `${drift} 1ms ${motion.easing.linear} both`,
              animationTimeline: inView ? 'view()' : 'scroll(root block)',
              animationRange: inView ? 'cover 0% cover 100%' : `0px ${range}px`,
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
