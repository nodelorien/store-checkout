import { Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Cache } from '../ports/cache.port';

/** The subset of the Redis client the cache needs (what tests replace). */
export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

const WARN_EVERY_MS = 30_000;

/**
 * Fails fast instead of queueing: a request must never wait for Redis longer than a database
 * read would take. Reconnection keeps running in the background.
 */
export function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    connectTimeout: 2000,
    commandTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });
  // Without a listener a connection error would be thrown as an unhandled event.
  client.on('error', () => undefined);
  return client;
}

/** Redis adapter of the cache port. Every failure is swallowed and reported as a miss. */
export class RedisCache implements Cache, OnModuleDestroy {
  private readonly logger = new Logger('Cache');
  private lastWarningAt = 0;

  constructor(private readonly client: RedisCommands) {}

  async get(key: string): Promise<string | undefined> {
    try {
      return (await this.client.get(key)) ?? undefined;
    } catch (cause) {
      this.warn('get', cause);
      return undefined;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (cause) {
      this.warn('set', cause);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (cause) {
      this.warn('delete', cause);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  /** The error name only (a message could carry the URL), and not on every request of an outage. */
  private warn(operation: string, cause: unknown): void {
    const now = Date.now();
    if (now - this.lastWarningAt < WARN_EVERY_MS) {
      return;
    }
    this.lastWarningAt = now;
    const name = cause instanceof Error ? cause.name : 'UnknownError';
    this.logger.warn(JSON.stringify({ operation, error: name, fallback: 'database' }));
  }
}
