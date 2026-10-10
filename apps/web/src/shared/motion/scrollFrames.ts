import { useEffect, useRef } from 'react';

export interface ScrollFrame {
  scrollY: number;
  viewportHeight: number;
}

export type ScrollFrameListener = (frame: ScrollFrame) => void;

type ScrollWindow = Pick<
  Window,
  | 'addEventListener'
  | 'removeEventListener'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'scrollY'
  | 'innerHeight'
>;

/**
 * Fallback for browsers without scroll-driven animation: one passive scroll listener for the whole
 * page, coalesced to one update per frame, attached only while something is subscribed.
 */
export function createScrollFrames(getWindow: () => ScrollWindow = () => window) {
  const listeners = new Set<ScrollFrameListener>();
  let pendingFrame = 0;

  const run = () => {
    pendingFrame = 0;
    const win = getWindow();
    const frame = { scrollY: win.scrollY, viewportHeight: win.innerHeight };
    listeners.forEach((listener) => listener(frame));
  };

  const schedule = () => {
    if (pendingFrame === 0) pendingFrame = getWindow().requestAnimationFrame(run);
  };

  return {
    subscribe(listener: ScrollFrameListener): () => void {
      const win = getWindow();
      if (listeners.size === 0) {
        win.addEventListener('scroll', schedule, { passive: true });
        win.addEventListener('resize', schedule);
      }
      listeners.add(listener);
      schedule();

      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        win.removeEventListener('scroll', schedule);
        win.removeEventListener('resize', schedule);
        if (pendingFrame !== 0) {
          win.cancelAnimationFrame(pendingFrame);
          pendingFrame = 0;
        }
      };
    },
  };
}

export const scrollFrames = createScrollFrames();

/** Runs `listener` once per scrolled frame while `enabled`. */
export function useScrollFrame(listener: ScrollFrameListener, enabled: boolean): void {
  const latest = useRef(listener);

  useEffect(() => {
    latest.current = listener;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    return scrollFrames.subscribe((frame) => latest.current(frame));
  }, [enabled]);
}
