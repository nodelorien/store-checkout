export const CLOCK = Symbol('CLOCK');

/** Time source. Injected so domain and use cases stay deterministic under test. */
export interface Clock {
  now(): Date;
  /** Resolves after `ms` milliseconds (used by the bounded payment poll). */
  sleep(ms: number): Promise<void>;
}
