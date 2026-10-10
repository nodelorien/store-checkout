import { delay } from './delay';

describe('delay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves after the given time', async () => {
    const done = jest.fn();
    void delay(2000).then(done);

    await jest.advanceTimersByTimeAsync(1999);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(delay(2000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects when the signal aborts while waiting', async () => {
    const controller = new AbortController();
    const pending = delay(2000, controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
  });
});
