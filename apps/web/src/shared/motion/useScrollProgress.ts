import { useRef } from 'react';
import { useParallaxMode } from './environment';
import { clamp01 } from './parallax';
import { useScrollFrame } from './scrollFrames';

/**
 * Fallback half of a scroll-linked style: writes how far the page has scrolled through `range`
 * (0–1) into the CSS variable `name` of the returned ref. With native scroll timelines the
 * variable is never written and CSS drives the style instead.
 */
export function useScrollProgress<T extends HTMLElement>(name: string, range: number) {
  const ref = useRef<T>(null);
  const mode = useParallaxMode();

  useScrollFrame(({ scrollY }) => {
    ref.current?.style.setProperty(name, clamp01(scrollY / range).toFixed(3));
  }, mode === 'fallback');

  return { ref, mode };
}
