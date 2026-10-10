import { useEffect, useRef, type MouseEvent } from 'react';
import { useReducedMotion } from './environment';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the pointer is over a box, from −1 (left / top edge) to 1 (right / bottom edge). */
export function pointerPosition(clientX: number, clientY: number, box: Box) {
  const along = (value: number, start: number, size: number) =>
    size > 0 ? Math.min(1, Math.max(-1, ((value - start) / size) * 2 - 1)) : 0;

  return { x: along(clientX, box.left, box.width), y: along(clientY, box.top, box.height) };
}

/**
 * Depth that follows the mouse: writes the pointer position over the element into the CSS
 * variables `--pointer-x` / `--pointer-y` (−1 to 1), at most once per frame, and returns to rest
 * when the pointer leaves. Layers read them through `ParallaxLayer`'s `pointer` prop. Mouse only
 * (touch screens get the scroll depth), and inert when motion is reduced.
 */
export function usePointerDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const enabled = !useReducedMotion();

  const write = (x: number, y: number) => {
    ref.current?.style.setProperty('--pointer-x', x.toFixed(3));
    ref.current?.style.setProperty('--pointer-y', y.toFixed(3));
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (!enabled) return { ref, handlers: {} };

  return {
    ref,
    handlers: {
      onMouseMove(event: MouseEvent<T>) {
        const { clientX, clientY } = event;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const element = ref.current;
          if (!element) return;
          const { x, y } = pointerPosition(clientX, clientY, element.getBoundingClientRect());
          write(x, y);
        });
      },
      onMouseLeave() {
        cancelAnimationFrame(frame.current);
        write(0, 0);
      },
    },
  };
}
