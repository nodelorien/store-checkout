/**
 * Replacement for `@/shared/lib/delay` in tests that involve polling: waits one macrotask instead
 * of the real interval (so the network mock keeps working with real timers) and still honours
 * abort signals. Use with `jest.mock('@/shared/lib/delay', () => require('@/test/delayMock'))`.
 */
export const delay = jest.fn(
  (_ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      setTimeout(resolve, 0);
    }),
);
