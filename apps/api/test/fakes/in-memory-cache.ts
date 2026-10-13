import { Cache } from '../../src/shared/ports/cache.port';

/** Keeps entries and the lifetime they were stored with; `unavailable` simulates an outage. */
export class InMemoryCache implements Cache {
  readonly entries = new Map<string, { value: string; ttlSeconds: number }>();
  readonly deleted: string[] = [];
  unavailable = false;

  async get(key: string): Promise<string | undefined> {
    return this.unavailable ? undefined : this.entries.get(key)?.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.unavailable) {
      this.entries.set(key, { value, ttlSeconds });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.unavailable) {
      this.deleted.push(key);
      this.entries.delete(key);
    }
  }
}
