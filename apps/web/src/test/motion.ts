import { act } from '@testing-library/react';

type Restore = () => void;

/** Makes `prefers-reduced-motion: reduce` match (or not) for the current test. */
export function mockReducedMotion(reduce: boolean): Restore {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** Pretends the browser has (or lacks) native scroll-driven animation. */
export function mockScrollTimelineSupport(supported: boolean): Restore {
  const target = globalThis as { CSS?: unknown };
  const original = target.CSS;
  target.CSS = { supports: () => supported };
  return () => {
    target.CSS = original;
  };
}

export interface ObserverHandle {
  observe: jest.Mock;
  disconnect: jest.Mock;
  /** Reports the observed element as entering (or not) the viewport. */
  enter: (isIntersecting?: boolean) => void;
}

/** Installs a controllable `IntersectionObserver`; jsdom has none. */
export function installViewportObserver(): { observers: ObserverHandle[]; restore: Restore } {
  const target = globalThis as { IntersectionObserver?: unknown };
  const original = target.IntersectionObserver;
  const observers: ObserverHandle[] = [];

  target.IntersectionObserver = function MockObserver(callback: IntersectionObserverCallback) {
    const handle: ObserverHandle = {
      observe: jest.fn(),
      disconnect: jest.fn(),
      enter: (isIntersecting = true) =>
        act(() =>
          callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            handle as unknown as IntersectionObserver,
          ),
        ),
    };
    observers.push(handle);
    return handle;
  };

  return {
    observers,
    restore: () => {
      target.IntersectionObserver = original;
    },
  };
}

/** Runs one animation frame per simulated scroll and exposes the window's scroll listeners. */
export function controlScrollFrames() {
  const add = jest.spyOn(window, 'addEventListener');
  const remove = jest.spyOn(window, 'removeEventListener');
  let queued: FrameRequestCallback | null = null;
  const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    queued = callback;
    return 1;
  });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    queued = null;
  });
  const flush = () => {
    const run = queued;
    queued = null;
    run?.(0);
  };
  const calls = (spy: jest.SpyInstance) => spy.mock.calls.filter(([type]) => type === 'scroll');

  return {
    scrollListenersAdded: () => calls(add),
    scrollListenersRemoved: () => calls(remove),
    scrollTo(y: number) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
      act(() => {
        window.dispatchEvent(new Event('scroll'));
        flush();
      });
    },
    restore() {
      add.mockRestore();
      remove.mockRestore();
      raf.mockRestore();
      cancel.mockRestore();
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    },
  };
}
