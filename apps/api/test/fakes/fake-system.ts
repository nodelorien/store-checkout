import { Clock } from '../../src/shared/ports/clock.port';
import { IdGenerator } from '../../src/shared/ports/id-generator.port';

/** Deterministic clock: `sleep` advances time instantly and records the requested delays. */
export class FakeClock implements Clock {
  readonly sleeps: number[] = [];
  private current: number;

  constructor(start = '2026-10-09T15:00:00.000Z') {
    this.current = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.current += ms;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

/** Sequential, predictable ids: `00000000-0000-4000-8000-000000000001`, … */
export class FakeIdGenerator implements IdGenerator {
  private counter = 0;

  uuid(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }

  randomBase32(length: number): string {
    return 'ABCDEFGH234567'.repeat(Math.ceil(length / 14)).slice(0, length);
  }
}
