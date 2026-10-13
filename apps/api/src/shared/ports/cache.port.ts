export const CACHE = Symbol('CACHE');

/**
 * Best-effort key/value store with expiry. A cache is an optimisation, never a dependency:
 * no method rejects, a failed read is a miss and a failed write or delete is ignored.
 */
export interface Cache {
  /** `undefined` on a miss, an expired entry or any failure. */
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
