import { DomainError } from '../errors/domain-error';
import { Cache } from '../ports/cache.port';
import { ok, Result } from '../result/result';

export interface ReadThroughOptions<T> {
  readonly cache: Cache;
  readonly key: string;
  readonly ttlSeconds: number;
  /** The real read. Only a successful result is stored. */
  readonly load: () => Promise<Result<T, DomainError>>;
  readonly encode: (value: T) => unknown;
  /** Rebuilds the value from parsed JSON; throw (or return `undefined`) to treat it as a miss. */
  readonly decode: (stored: unknown) => T | undefined;
}

function restore<T>(text: string, decode: (stored: unknown) => T | undefined): T | undefined {
  try {
    return decode(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** Cache-aside read: serve the stored value, otherwise load it and store it for `ttlSeconds`. */
export async function readThrough<T>(
  options: ReadThroughOptions<T>,
): Promise<Result<T, DomainError>> {
  const stored = await options.cache.get(options.key);
  if (stored !== undefined) {
    const value = restore(stored, options.decode);
    if (value !== undefined) {
      return ok(value);
    }
  }

  const loaded = await options.load();
  if (loaded.isOk()) {
    await options.cache.set(
      options.key,
      JSON.stringify(options.encode(loaded.value)),
      options.ttlSeconds,
    );
  }
  return loaded;
}
