import {
  combine,
  err,
  errAsync,
  fromResult,
  ok,
  okAsync,
  Result,
  ResultAsync,
  tryAsync,
} from './result';

const double = (n: number): number => n * 2;

describe('Result', () => {
  describe('ok track', () => {
    const result: Result<number, string> = ok(2);

    it('AC-1: exposes the value and identifies itself', () => {
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.kind).toBe('ok');
    });

    it('AC-1: map transforms the value', () => {
      expect(result.map(double)).toEqual(ok(4));
    });

    it('AC-1: mapErr leaves the value untouched', () => {
      expect(result.mapErr((e) => e.length)).toEqual(ok(2));
    });

    it('AC-1: andThen chains into the next result', () => {
      expect(result.andThen((n) => ok(n + 1))).toEqual(ok(3));
      expect(result.andThen(() => err('boom'))).toEqual(err('boom'));
    });

    it('AC-1: orElse is skipped', () => {
      const recover = jest.fn(() => ok(0));
      expect(result.orElse(recover)).toEqual(ok(2));
      expect(recover).not.toHaveBeenCalled();
    });

    it('AC-1: match and unwrapOr take the ok branch', () => {
      expect(
        result.match(
          (n) => `ok ${n}`,
          (e) => `err ${e}`,
        ),
      ).toBe('ok 2');
      expect(result.unwrapOr(0)).toBe(2);
    });
  });

  describe('err track', () => {
    const result: Result<number, string> = err('bad');

    it('AC-1: identifies itself', () => {
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.kind).toBe('err');
    });

    it('AC-1: map and andThen short-circuit', () => {
      const fn = jest.fn(double);
      const next = jest.fn((n: number) => ok<number, string>(n));
      expect(result.map(fn)).toEqual(err('bad'));
      expect(result.andThen(next)).toEqual(err('bad'));
      expect(fn).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('AC-1: mapErr transforms the error', () => {
      expect(result.mapErr((e) => e.toUpperCase())).toEqual(err('BAD'));
    });

    it('AC-1: orElse recovers', () => {
      expect(result.orElse(() => ok(0))).toEqual(ok(0));
      expect(result.orElse((e) => err(`${e}!`))).toEqual(err('bad!'));
    });

    it('AC-1: match and unwrapOr take the err branch', () => {
      expect(
        result.match(
          (n) => `ok ${n}`,
          (e) => `err ${e}`,
        ),
      ).toBe('err bad');
      expect(result.unwrapOr(0)).toBe(0);
    });
  });

  describe('combine', () => {
    it('AC-1: collects every value', () => {
      expect(combine([ok(1), ok(2)])).toEqual(ok([1, 2]));
    });

    it('AC-1: returns the first error', () => {
      expect(combine([ok(1), err('a'), err('b')])).toEqual(err('a'));
    });
  });
});

describe('ResultAsync', () => {
  it('AC-1: is awaitable and yields the wrapped result', async () => {
    expect(await okAsync(1)).toEqual(ok(1));
    expect(await errAsync('x')).toEqual(err('x'));
    expect(await fromResult(Promise.resolve(ok(1))).toPromise()).toEqual(ok(1));
  });

  it('AC-1: map accepts sync and async functions', async () => {
    expect(await okAsync(2).map(double)).toEqual(ok(4));
    expect(await okAsync(2).map(async (n) => n + 1)).toEqual(ok(3));
  });

  it('AC-1: map short-circuits on the error track', async () => {
    const fn = jest.fn(double);
    expect(await errAsync<string, number>('x').map(fn)).toEqual(err('x'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('AC-1: mapErr transforms only errors', async () => {
    expect(await errAsync('x').mapErr((e) => e + e)).toEqual(err('xx'));
    expect(await okAsync<number, string>(1).mapErr((e) => e + e)).toEqual(ok(1));
  });

  it('AC-1: andThen chains sync results, promises and ResultAsync', async () => {
    const chained = okAsync<number, string>(1)
      .andThen((n) => ok(n + 1))
      .andThen((n) => Promise.resolve(ok(n + 1)))
      .andThen((n) => okAsync(n + 1));
    expect(await chained).toEqual(ok(4));
  });

  it('AC-1: andThen short-circuits after the first error', async () => {
    const never = jest.fn(() => ok(0));
    const chained = okAsync(1)
      .andThen(() => err('stop'))
      .andThen(never);
    expect(await chained).toEqual(err('stop'));
    expect(never).not.toHaveBeenCalled();
  });

  it('AC-1: orElse recovers from errors and skips successes', async () => {
    expect(await errAsync('x').orElse(() => ok(9))).toEqual(ok(9));
    expect(await errAsync('x').orElse((e) => Promise.resolve(err(`${e}y`)))).toEqual(err('xy'));
    const recover = jest.fn(() => ok(0));
    expect(await okAsync(1).orElse(recover)).toEqual(ok(1));
    expect(recover).not.toHaveBeenCalled();
  });

  it('AC-1: tap runs a side effect and keeps the value', async () => {
    const seen: number[] = [];
    expect(await okAsync(5).tap((n) => void seen.push(n))).toEqual(ok(5));
    expect(seen).toEqual([5]);
    const skipped = jest.fn();
    await errAsync('x').tap(skipped);
    expect(skipped).not.toHaveBeenCalled();
  });

  it('AC-1: match resolves with the matching branch', async () => {
    const describeResult = (r: ResultAsync<number, string>): Promise<string> =>
      r.match(
        (n) => `ok ${n}`,
        (e) => `err ${e}`,
      );
    expect(await describeResult(okAsync(1))).toBe('ok 1');
    expect(await describeResult(errAsync('x'))).toBe('err x');
  });
});

describe('tryAsync', () => {
  it('AC-1: wraps a resolved promise in ok', async () => {
    expect(await tryAsync(async () => 1, String)).toEqual(ok(1));
  });

  it('AC-1: converts a rejection into err', async () => {
    const result = await tryAsync(
      async () => {
        throw new Error('down');
      },
      (cause) => (cause as Error).message,
    );
    expect(result).toEqual(err('down'));
  });
});
