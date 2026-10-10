import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';

export const REPORT_TIME_ZONE = 'America/Bogota';
export const DEFAULT_REPORT_DAYS = 14;
export const MAX_REPORT_DAYS = 90;

/** The zone is UTC−5 all year (no daylight saving), so a fixed offset is exact. */
const ZONE_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10);

/** Calendar day (`YYYY-MM-DD`) of an instant in the report time zone; `null` if it is not a date. */
export function reportDayOf(instant: string | Date): string | null {
  const epochMs = instant instanceof Date ? instant.getTime() : Date.parse(instant);
  return Number.isNaN(epochMs) ? null : isoDate(epochMs + ZONE_OFFSET_MS);
}

/** The last `days` calendar days of the report time zone, ending today (inclusive). */
export class ReportRange {
  private constructor(
    /** First day, `YYYY-MM-DD`. */
    readonly from: string,
    /** Last day (today), `YYYY-MM-DD`. */
    readonly to: string,
    readonly days: number,
    /** UTC instant at which the first day starts — the lower bound for the store query. */
    readonly fromInstant: string,
  ) {}

  static create(days: number | undefined, now: Date): Result<ReportRange, DomainError> {
    const count = days ?? DEFAULT_REPORT_DAYS;
    if (!Number.isInteger(count) || count < 1 || count > MAX_REPORT_DAYS) {
      return err(
        DomainErrors.invalidField(
          'days',
          `days must be an integer between 1 and ${MAX_REPORT_DAYS}`,
        ),
      );
    }
    const todayStartMs =
      Math.floor((now.getTime() + ZONE_OFFSET_MS) / DAY_MS) * DAY_MS - ZONE_OFFSET_MS;
    const fromStartMs = todayStartMs - (count - 1) * DAY_MS;
    return ok(
      new ReportRange(
        isoDate(fromStartMs + ZONE_OFFSET_MS),
        isoDate(todayStartMs + ZONE_OFFSET_MS),
        count,
        new Date(fromStartMs).toISOString(),
      ),
    );
  }

  /** Every day of the range, oldest first. */
  dates(): string[] {
    const firstMs = Date.parse(`${this.from}T00:00:00.000Z`);
    return Array.from({ length: this.days }, (_, index) => isoDate(firstMs + index * DAY_MS));
  }

  includes(day: string | null): boolean {
    return day !== null && day >= this.from && day <= this.to;
  }
}
