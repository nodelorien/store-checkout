import { aSalesRecord } from '../../../../../test/builders/sales-record.builder';
import { FakeClock } from '../../../../../test/fakes/fake-system';
import { InMemorySalesRecords } from '../../../../../test/fakes/in-memory-sales-records';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { DomainErrors } from '../../../../shared/errors/domain-error';
import { GetSalesSummaryUseCase } from './get-sales-summary.use-case';

function setup(now = '2026-10-10T15:00:00.000Z') {
  const records = new InMemorySalesRecords([
    aSalesRecord({ createdAt: '2026-10-10T14:00:00.000Z', totalInCents: 1_000 }),
    aSalesRecord({ createdAt: '2026-09-27T05:00:00.000Z', totalInCents: 2_000 }),
    aSalesRecord({ createdAt: '2026-09-27T04:59:59.999Z', totalInCents: 4_000 }),
  ]);
  return { records, useCase: new GetSalesSummaryUseCase(records, new FakeClock(now)) };
}

describe('GetSalesSummaryUseCase', () => {
  it('AC-1: summarises the last 14 days by default, reading from the first instant of the range', async () => {
    const { useCase, records } = setup();

    const summary = expectOk(await useCase.execute());

    expect(records.requestedSince).toEqual(['2026-09-27T05:00:00.000Z']);
    expect(summary.range).toEqual({ from: '2026-09-27', to: '2026-10-10', days: 14 });
    expect(summary.totals).toMatchObject({ approvedOrders: 2, revenueInCents: 3_000 });
    expect(summary.salesByDay).toHaveLength(14);
    expect(summary.generatedAt).toBe('2026-10-10T15:00:00.000Z');
  });

  it('AC-2: honours `days` and takes "today" from the injected clock in Bogota time', async () => {
    const { useCase, records } = setup('2026-10-11T02:00:00.000Z'); // still the 10th in Bogota

    const summary = expectOk(await useCase.execute({ days: 1 }));

    expect(records.requestedSince).toEqual(['2026-10-10T05:00:00.000Z']);
    expect(summary.range).toEqual({ from: '2026-10-10', to: '2026-10-10', days: 1 });
    expect(summary.totals.revenueInCents).toBe(1_000);
  });

  it('AC-9: returns VALIDATION_ERROR for days out of range without reading the store', async () => {
    const { useCase, records } = setup();

    expectErr(await useCase.execute({ days: 91 }), 'VALIDATION_ERROR');
    expectErr(await useCase.execute({ days: 0 }), 'VALIDATION_ERROR');
    expect(records.requestedSince).toEqual([]);
  });

  it('AC-10: propagates a persistence failure', async () => {
    const { useCase, records } = setup();
    records.failWith = DomainErrors.persistence();

    expectErr(await useCase.execute(), 'PERSISTENCE_ERROR');
  });
});
