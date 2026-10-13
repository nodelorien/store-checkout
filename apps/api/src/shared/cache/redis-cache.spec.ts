import { Logger } from '@nestjs/common';
import { NoopCache } from './noop-cache';
import { createRedisClient, RedisCache, RedisCommands } from './redis-cache';

function fakeClient(): jest.Mocked<RedisCommands> {
  return {
    get: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
    set: jest.fn<Promise<unknown>, [string, string, 'EX', number]>().mockResolvedValue('OK'),
    del: jest.fn<Promise<unknown>, [string]>().mockResolvedValue(1),
    quit: jest.fn<Promise<unknown>, []>().mockResolvedValue('OK'),
  };
}

class ConnectionError extends Error {
  constructor() {
    super('connect ECONNREFUSED redis://user:super-secret@cache.internal:6379');
    this.name = 'ConnectionError';
  }
}

describe('RedisCache', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('AC-1: returns the stored text and undefined on a miss', async () => {
    const client = fakeClient();
    client.get.mockResolvedValueOnce('{"a":1}');
    const cache = new RedisCache(client);

    expect(await cache.get('k')).toBe('{"a":1}');
    expect(await cache.get('k')).toBeUndefined();
    expect(client.get).toHaveBeenCalledWith('k');
  });

  it('AC-1: stores with an expiry in seconds', async () => {
    const client = fakeClient();

    await new RedisCache(client).set('k', 'v', 60);

    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 60);
  });

  it('AC-2: deletes a key', async () => {
    const client = fakeClient();

    await new RedisCache(client).delete('k');

    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('AC-5: a failing read is a miss, a failing write or delete is ignored', async () => {
    const client = fakeClient();
    client.get.mockRejectedValue(new ConnectionError());
    client.set.mockRejectedValue(new ConnectionError());
    client.del.mockRejectedValue('not even an error');
    const cache = new RedisCache(client);

    expect(await cache.get('k')).toBeUndefined();
    await expect(cache.set('k', 'v', 1)).resolves.toBeUndefined();
    await expect(cache.delete('k')).resolves.toBeUndefined();
  });

  it('AC-5: logs the error name only, never the message that may carry the URL', async () => {
    const client = fakeClient();
    client.get.mockRejectedValue(new ConnectionError());

    await new RedisCache(client).get('k');

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = String(warn.mock.calls[0][0]);
    expect(JSON.parse(logged)).toEqual({
      operation: 'get',
      error: 'ConnectionError',
      fallback: 'database',
    });
    expect(logged).not.toContain('super-secret');
  });

  it('AC-5: names an unknown failure and warns once per 30 seconds during an outage', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-13T12:00:00Z') });
    const client = fakeClient();
    client.del.mockRejectedValue('boom');
    const cache = new RedisCache(client);

    await cache.delete('k');
    await cache.delete('k');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('UnknownError');

    jest.setSystemTime(new Date('2026-10-13T12:00:31Z'));
    await cache.delete('k');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('closes the connection with the application, even if closing fails', async () => {
    const client = fakeClient();
    client.quit.mockRejectedValueOnce(new ConnectionError());
    const cache = new RedisCache(client);

    await expect(cache.onModuleDestroy()).resolves.toBeUndefined();
    await cache.onModuleDestroy();

    expect(client.quit).toHaveBeenCalledTimes(2);
  });
});

describe('createRedisClient', () => {
  it('AC-5: fails fast instead of queueing commands while disconnected', async () => {
    // Port 1 is never listening: the client is created, nothing is awaited on the network.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const client = createRedisClient('redis://127.0.0.1:1');

    expect(client.options).toMatchObject({
      connectTimeout: 2000,
      commandTimeout: 500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    expect(client.options.retryStrategy?.(1)).toBe(200);
    expect(client.options.retryStrategy?.(100)).toBe(5000);
    expect(client.listenerCount('error')).toBeGreaterThan(0);
    await expect(new RedisCache(client).get('k')).resolves.toBeUndefined();

    client.disconnect();
    jest.restoreAllMocks();
  });
});

describe('NoopCache', () => {
  it('AC-6: never stores anything', async () => {
    const cache = new NoopCache();

    await cache.set();
    await cache.delete();

    expect(await cache.get()).toBeUndefined();
  });
});
