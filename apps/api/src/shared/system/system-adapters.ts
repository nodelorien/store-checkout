import { randomInt, randomUUID } from 'node:crypto';
import { Clock } from '../ports/clock.port';
import { IdGenerator } from '../ports/id-generator.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }

  randomBase32(length: number): string {
    let output = '';
    for (let index = 0; index < length; index += 1) {
      output += BASE32_ALPHABET[randomInt(BASE32_ALPHABET.length)];
    }
    return output;
  }
}
