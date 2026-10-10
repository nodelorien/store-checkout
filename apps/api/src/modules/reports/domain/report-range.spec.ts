import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { ReportRange, reportDayOf } from './report-range';

const at = (iso: string): Date => new Date(iso);

describe('reportDayOf', () => {
  it('AC-2: gives the calendar day in America/Bogota (UTC-5)', () => {
    expect(reportDayOf('2026-10-10T04:59:59.999Z')).toBe('2026-10-09');
    expect(reportDayOf('2026-10-10T05:00:00.000Z')).toBe('2026-10-10');
    expect(reportDayOf(at('2026-10-11T04:59:59.999Z'))).toBe('2026-10-10');
    expect(reportDayOf('2027-01-01T02:00:00.000Z')).toBe('2026-12-31');
  });

  it('returns null for a value that is not a date', () => {
    expect(reportDayOf('not-a-date')).toBeNull();
    expect(reportDayOf('')).toBeNull();
  });
});

describe('ReportRange.create', () => {
  it('AC-1: defaults to 14 days ending today', () => {
    const range = expectOk(ReportRange.create(undefined, at('2026-10-10T15:00:00.000Z')));

    expect(range).toMatchObject({ from: '2026-09-27', to: '2026-10-10', days: 14 });
    expect(range.fromInstant).toBe('2026-09-27T05:00:00.000Z');
  });

  it('AC-2: "today" is the Bogota day, also when UTC is already tomorrow', () => {
    const lateEvening = expectOk(ReportRange.create(1, at('2026-10-11T03:30:00.000Z')));
    const justAfterMidnight = expectOk(ReportRange.create(1, at('2026-10-11T05:00:00.000Z')));

    expect(lateEvening).toMatchObject({ from: '2026-10-10', to: '2026-10-10', days: 1 });
    expect(lateEvening.fromInstant).toBe('2026-10-10T05:00:00.000Z');
    expect(justAfterMidnight).toMatchObject({ from: '2026-10-11', to: '2026-10-11' });
    expect(justAfterMidnight.fromInstant).toBe('2026-10-11T05:00:00.000Z');
  });

  it('AC-2: spans month and year boundaries', () => {
    const range = expectOk(ReportRange.create(90, at('2027-01-15T12:00:00.000Z')));

    expect(range).toMatchObject({ from: '2026-10-18', to: '2027-01-15', days: 90 });
  });

  it.each([0, -3, 91, 1.5, Number.NaN])('AC-9: rejects days = %p', (days) => {
    const error = expectErr(
      ReportRange.create(days, at('2026-10-10T15:00:00.000Z')),
      'VALIDATION_ERROR',
    );

    expect(error.details).toEqual([
      { field: 'days', message: 'days must be an integer between 1 and 90' },
    ]);
  });
});

describe('ReportRange', () => {
  const range = expectOk(ReportRange.create(3, at('2026-10-01T15:00:00.000Z')));

  it('AC-4: lists every day, oldest first', () => {
    expect(range.dates()).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('tells whether a day belongs to it', () => {
    expect(range.includes('2026-09-28')).toBe(false);
    expect(range.includes('2026-09-29')).toBe(true);
    expect(range.includes('2026-10-01')).toBe(true);
    expect(range.includes('2026-10-02')).toBe(false);
    expect(range.includes(null)).toBe(false);
  });
});
