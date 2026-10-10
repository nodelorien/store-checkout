import Box, { type BoxProps } from '@mui/material/Box';
import { useEffect, useRef, useState } from 'react';
import { supportsViewportObserver, useReducedMotion } from './environment';
import { staggerDelay } from './parallax';
import { motion } from './tokens';

export type RevealState = 'static' | 'pending' | 'shown';

/**
 * Tracks the first time an element enters the viewport. Content is always rendered: without a
 * viewport observer, or with reduced motion, it is simply shown (`static`).
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const animated = !reduced && supportsViewportObserver();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!animated || entered || !element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [animated, entered]);

  const state: RevealState = !animated ? 'static' : entered ? 'shown' : 'pending';
  return { ref, state };
}

/** Fade-and-rise styles for a reveal state; `index` staggers siblings that enter together. */
export function revealSx(state: RevealState, index = 0) {
  if (state === 'static') return {};
  const { enter } = motion.duration;
  const timing = `${enter}ms ${motion.easing.decelerate} ${staggerDelay(index)}ms`;

  return {
    opacity: state === 'shown' ? 1 : 0,
    transform: state === 'shown' ? 'none' : `translate3d(0, ${motion.distance.rise}px, 0)`,
    transition: `opacity ${timing}, transform ${timing}`,
  };
}

interface RevealProps extends Omit<BoxProps, 'ref'> {
  /** Position among siblings that enter together. */
  index?: number;
}

/** Wrapper that fades its content in, once, the first time it enters the viewport. */
export function Reveal({ index = 0, sx, children, ...boxProps }: RevealProps) {
  const { ref, state } = useReveal<HTMLDivElement>();

  return (
    <Box
      ref={ref}
      data-reveal={state}
      {...boxProps}
      sx={[revealSx(state, index), ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </Box>
  );
}
