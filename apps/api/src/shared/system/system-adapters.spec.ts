import { CryptoIdGenerator, SystemClock } from './system-adapters';

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('sleeps for the requested time', async () => {
    jest.useFakeTimers();
    const done = jest.fn();
    const sleeping = new SystemClock().sleep(500).then(done);

    await jest.advanceTimersByTimeAsync(499);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await sleeping;
    expect(done).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('CryptoIdGenerator', () => {
  const ids = new CryptoIdGenerator();

  it('generates v4 UUIDs', () => {
    expect(ids.uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(ids.uuid()).not.toBe(ids.uuid());
  });

  it('generates uppercase base32 strings of the requested length', () => {
    expect(ids.randomBase32(8)).toMatch(/^[A-Z2-7]{8}$/);
    expect(ids.randomBase32(0)).toBe('');
  });
});
