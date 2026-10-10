/**
 * Railway-oriented programming primitives (ADR-0003).
 * `Result` is the synchronous track, `ResultAsync` wraps a promise of a `Result` so steps that
 * hit ports can be chained without `await` / `try` / `catch`.
 */

export class Ok<T, E> {
  readonly kind = 'ok' as const;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value);
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  orElse<U, F>(_fn: (error: E) => Result<U, F>): Result<T | U, F> {
    return new Ok(this.value);
  }

  match<A, B = A>(onOk: (value: T) => A, _onErr: (error: E) => B): A | B {
    return onOk(this.value);
  }

  unwrapOr<D>(_fallback: D): T | D {
    return this.value;
  }
}

export class Err<T, E> {
  readonly kind = 'err' as const;

  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return new Err(this.error);
  }

  orElse<U, F>(fn: (error: E) => Result<U, F>): Result<T | U, F> {
    return fn(this.error);
  }

  match<A, B = A>(_onOk: (value: T) => A, onErr: (error: E) => B): A | B {
    return onErr(this.error);
  }

  unwrapOr<D>(fallback: D): T | D {
    return fallback;
  }
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export function ok<T, E = never>(value: T): Result<T, E> {
  return new Ok(value);
}

export function err<E, T = never>(error: E): Result<T, E> {
  return new Err(error);
}

/** Turns a list of results into a result of a list; the first error wins. */
export function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
}

type MaybeAsyncResult<T, E> = Result<T, E> | PromiseLike<Result<T, E>>;

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  constructor(private readonly promise: Promise<Result<T, E>>) {}

  map<U>(fn: (value: T) => U | Promise<U>): ResultAsync<U, E> {
    return new ResultAsync(
      this.promise.then(async (result) =>
        result.isOk() ? ok<U, E>(await fn(result.value)) : err<E, U>(result.error),
      ),
    );
  }

  mapErr<F>(fn: (error: E) => F): ResultAsync<T, F> {
    return new ResultAsync(this.promise.then((result) => result.mapErr(fn)));
  }

  andThen<U, F>(fn: (value: T) => MaybeAsyncResult<U, F>): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(
      this.promise.then(async (result) =>
        result.isOk() ? await fn(result.value) : err<E | F, U>(result.error),
      ),
    );
  }

  /** Recovers from (or replaces) an error. */
  orElse<U, F>(fn: (error: E) => MaybeAsyncResult<U, F>): ResultAsync<T | U, F> {
    return new ResultAsync<T | U, F>(
      this.promise.then(async (result) =>
        result.isErr() ? await fn(result.error) : ok<T | U, F>(result.value),
      ),
    );
  }

  /** Runs a side effect on the success track without changing the value. */
  tap(fn: (value: T) => void | Promise<void>): ResultAsync<T, E> {
    return this.map(async (value) => {
      await fn(value);
      return value;
    });
  }

  match<A, B = A>(onOk: (value: T) => A, onErr: (error: E) => B): Promise<A | B> {
    return this.promise.then((result) => result.match(onOk, onErr));
  }

  toPromise(): Promise<Result<T, E>> {
    return this.promise;
  }

  then<R1 = Result<T, E>, R2 = never>(
    onFulfilled?: ((value: Result<T, E>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.promise.then(onFulfilled, onRejected);
  }
}

/** Lifts a sync result or a promise of a result (what ports return) onto the async railway. */
export function fromResult<T, E>(result: MaybeAsyncResult<T, E>): ResultAsync<T, E> {
  return new ResultAsync(Promise.resolve(result));
}

export function okAsync<T, E = never>(value: T): ResultAsync<T, E> {
  return fromResult(ok<T, E>(value));
}

export function errAsync<E, T = never>(error: E): ResultAsync<T, E> {
  return fromResult(err<E, T>(error));
}

/** Boundary helper for adapters: converts a throwing async call into a `Result`. */
export async function tryAsync<T, E>(
  fn: () => Promise<T>,
  onThrow: (cause: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(onThrow(cause));
  }
}
