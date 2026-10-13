import { randomUUID } from 'node:crypto';
import { createRedisClient, RedisCache } from '../../src/shared/cache/redis-cache';
import { REDIS_URL } from './support/integration-app';

/** The cache adapter against a real Redis: the expiry and the fail-open contract. */
describe('RedisCache (integration)', () => {
  const key = `it-cache:${randomUUID()}`;
  const client = createRedisClient(REDIS_URL);
  const cache = new RedisCache(client);

  beforeAll(async () => {
    // Commands are not queued while disconnected, so wait for the connection.
    let timer: NodeJS.Timeout | undefined;
    const ready = new Promise<void>((resolve) => client.once('ready', resolve));
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(`Redis is not reachable at ${REDIS_URL}. Run: docker compose up -d redis`),
          ),
        3000,
      );
    });
    await Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
  });

  afterAll(async () => {
    await cache.delete(key);
    await cache.onModuleDestroy();
  });

  it('stores, reads back and deletes a value', async () => {
    expect(await cache.get(key)).toBeUndefined();

    await cache.set(key, '{"stock":5}', 30);
    expect(await cache.get(key)).toBe('{"stock":5}');

    await cache.delete(key);
    expect(await cache.get(key)).toBeUndefined();
  });

  it('expires an entry after its lifetime', async () => {
    await cache.set(key, 'short-lived', 1);
    expect(await cache.get(key)).toBe('short-lived');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(await cache.get(key)).toBeUndefined();
  });

  it('answers a miss, quickly, when Redis is unreachable', async () => {
    const down = createRedisClient('redis://127.0.0.1:1');
    const unreachable = new RedisCache(down);
    const started = Date.now();

    expect(await unreachable.get(key)).toBeUndefined();
    await expect(unreachable.set(key, 'x', 1)).resolves.toBeUndefined();
    await expect(unreachable.delete(key)).resolves.toBeUndefined();

    expect(Date.now() - started).toBeLessThan(1000);
    down.disconnect();
  });
});
