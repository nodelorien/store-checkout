import { InMemoryCache } from '../../../test/fakes/in-memory-cache';
import { expectErr, expectOk } from '../../../test/helpers/result-assertions';
import { DomainError, DomainErrors } from '../errors/domain-error';
import { err, ok, Result } from '../result/result';
import { readThrough } from './read-through';

interface Thing {
  readonly n: number;
}

function setup(result: Result<Thing, DomainError> = ok({ n: 7 })) {
  const cache = new InMemoryCache();
  const load = jest.fn(async () => result);
  const read = () =>
    readThrough<Thing>({
      cache,
      key: 'thing',
      ttlSeconds: 45,
      load,
      encode: (value) => ({ n: value.n }),
      decode: (stored) => {
        const n = (stored as { n?: unknown }).n;
        return typeof n === 'number' ? { n } : undefined;
      },
    });
  return { cache, load, read };
}

describe('readThrough', () => {
  it('AC-1: loads once, stores with the lifetime and serves the next read from the cache', async () => {
    const { cache, load, read } = setup();

    expect(expectOk(await read())).toEqual({ n: 7 });
    expect(expectOk(await read())).toEqual({ n: 7 });

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.entries.get('thing')).toEqual({ value: '{"n":7}', ttlSeconds: 45 });
  });

  it('AC-3: returns the failure and stores nothing', async () => {
    const { cache, load, read } = setup(err(DomainErrors.persistence()));

    expectErr(await read(), 'PERSISTENCE_ERROR');
    expectErr(await read(), 'PERSISTENCE_ERROR');

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(0);
  });

  it.each([
    ['is not JSON', 'not json at all'],
    ['is rejected by the decoder', '{"n":"seven"}'],
    ['makes the decoder throw', 'null'],
  ])('AC-5: an entry that %s is a miss and is overwritten', async (_case, stored) => {
    const { cache, load, read } = setup();
    cache.entries.set('thing', { value: stored, ttlSeconds: 45 });

    expect(expectOk(await read())).toEqual({ n: 7 });

    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.entries.get('thing')?.value).toBe('{"n":7}');
  });

  it('AC-5: with the cache unavailable every read loads', async () => {
    const { cache, load, read } = setup();
    cache.unavailable = true;

    expectOk(await read());
    expectOk(await read());

    expect(load).toHaveBeenCalledTimes(2);
  });
});
