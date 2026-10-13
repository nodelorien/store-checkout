import { aSalesRecord } from '../../../../../test/builders/sales-record.builder';
import { InMemoryCache } from '../../../../../test/fakes/in-memory-cache';
import { InMemorySalesRecords } from '../../../../../test/fakes/in-memory-sales-records';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { CachedSalesRecordsAdapter } from './cached-sales-records.adapter';

const OCTOBER = '2026-10-01T05:00:00.000Z';
const SEPTEMBER = '2026-09-01T05:00:00.000Z';

function setup() {
  const inner = new InMemorySalesRecords([aSalesRecord()]);
  const cache = new InMemoryCache();
  const adapter = new CachedSalesRecordsAdapter(inner, cache, {
    namespace: 'test-transactions',
    ttlSeconds: 30,
  });
  return { inner, cache, adapter };
}

describe('CachedSalesRecordsAdapter', () => {
  it('AC-4: reads a range once within its lifetime', async () => {
    const { inner, cache, adapter } = setup();

    const first = expectOk(await adapter.findCreatedSince(OCTOBER));
    const second = expectOk(await adapter.findCreatedSince(OCTOBER));

    expect(second).toEqual(first);
    expect(inner.requestedSince).toEqual([OCTOBER]);
    expect(cache.entries.get(`sales:test-transactions:${OCTOBER}`)?.ttlSeconds).toBe(30);
  });

  it('AC-4: another range is read and stored separately', async () => {
    const { inner, cache, adapter } = setup();

    expectOk(await adapter.findCreatedSince(OCTOBER));
    expectOk(await adapter.findCreatedSince(SEPTEMBER));

    expect(inner.requestedSince).toEqual([OCTOBER, SEPTEMBER]);
    expect(cache.entries.size).toBe(2);
  });

  it('AC-3: a failing read is returned and not cached', async () => {
    const { inner, cache, adapter } = setup();
    inner.failWith = DomainErrors.persistence();

    expectErr(await adapter.findCreatedSince(OCTOBER), 'PERSISTENCE_ERROR');

    expect(cache.entries.size).toBe(0);
  });

  it('AC-5: an entry that is not a list is ignored', async () => {
    const { inner, cache, adapter } = setup();
    cache.entries.set(`sales:test-transactions:${OCTOBER}`, { value: '"text"', ttlSeconds: 30 });

    expect(expectOk(await adapter.findCreatedSince(OCTOBER))).toHaveLength(1);
    expect(inner.requestedSince).toEqual([OCTOBER]);
  });
});
