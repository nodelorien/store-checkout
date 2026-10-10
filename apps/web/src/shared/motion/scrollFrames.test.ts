import { createScrollFrames } from './scrollFrames';

function fakeWindow() {
  const handlers = new Map<string, { handler: () => void; options: unknown }[]>();
  let queued: (() => void) | null = null;

  const win = {
    scrollY: 0,
    innerHeight: 667,
    addEventListener: jest.fn((type: string, handler: () => void, options?: unknown) => {
      handlers.set(type, [...(handlers.get(type) ?? []), { handler, options }]);
    }),
    removeEventListener: jest.fn((type: string, handler: () => void) => {
      handlers.set(
        type,
        (handlers.get(type) ?? []).filter((entry) => entry.handler !== handler),
      );
    }),
    requestAnimationFrame: jest.fn((callback: () => void) => {
      queued = callback;
      return 7;
    }),
    cancelAnimationFrame: jest.fn(() => {
      queued = null;
    }),
  };

  return {
    win,
    listeners: (type: string) => handlers.get(type) ?? [],
    scroll(y: number) {
      win.scrollY = y;
      this.listeners('scroll').forEach((entry) => entry.handler());
    },
    nextFrame() {
      const run = queued;
      queued = null;
      run?.();
    },
  };
}

describe('scroll fallback', () => {
  it('AC-7: shares exactly one passive scroll listener between every subscriber', () => {
    const page = fakeWindow();
    const frames = createScrollFrames(() => page.win as never);

    frames.subscribe(jest.fn());
    frames.subscribe(jest.fn());
    frames.subscribe(jest.fn());

    expect(page.listeners('scroll')).toHaveLength(1);
    expect(page.listeners('scroll')[0].options).toEqual({ passive: true });
  });

  it('AC-7: updates at most once per frame however many scroll events arrive', () => {
    const page = fakeWindow();
    const frames = createScrollFrames(() => page.win as never);
    const listener = jest.fn();
    frames.subscribe(listener);
    page.nextFrame();
    listener.mockClear();

    page.scroll(10);
    page.scroll(40);
    page.scroll(90);
    page.nextFrame();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ scrollY: 90, viewportHeight: 667 });
  });

  it('positions a new subscriber on the next frame without waiting for a scroll', () => {
    const page = fakeWindow();
    const frames = createScrollFrames(() => page.win as never);
    const listener = jest.fn();

    frames.subscribe(listener);
    page.nextFrame();

    expect(listener).toHaveBeenCalledWith({ scrollY: 0, viewportHeight: 667 });
  });

  it('AC-7: removes the listener and the pending frame when the last subscriber leaves', () => {
    const page = fakeWindow();
    const frames = createScrollFrames(() => page.win as never);
    const first = frames.subscribe(jest.fn());
    const second = frames.subscribe(jest.fn());

    first();
    expect(page.listeners('scroll')).toHaveLength(1);

    second();
    expect(page.listeners('scroll')).toHaveLength(0);
    expect(page.listeners('resize')).toHaveLength(0);
    expect(page.win.cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('does not cancel a frame that already ran', () => {
    const page = fakeWindow();
    const frames = createScrollFrames(() => page.win as never);
    const unsubscribe = frames.subscribe(jest.fn());
    page.nextFrame();

    unsubscribe();

    expect(page.win.cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
