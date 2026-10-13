import { Cache } from '../ports/cache.port';

/** Used when no Redis is configured: every read is a miss and nothing is stored. */
export class NoopCache implements Cache {
  async get(): Promise<string | undefined> {
    return undefined;
  }

  async set(): Promise<void> {}

  async delete(): Promise<void> {}
}
