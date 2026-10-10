import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import {
  GatewayEvent,
  GatewayEventVerifier,
} from '../../application/ports/gateway-event-verifier.port';

/** Reads `a.b.c` from own properties only; `undefined` unless the leaf is a scalar. */
function scalarAt(data: Record<string, unknown>, path: string): string | undefined {
  let current: unknown = data;
  for (const segment of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean'
    ? String(current)
    : undefined;
}

/**
 * `sha256_hex(values of signature.properties, in order + timestamp + eventsSecret)`.
 * Returns `undefined` when a signed property is missing, so such an event can never verify.
 */
export function computeEventChecksum(
  event: GatewayEvent,
  eventsSecret: string,
): string | undefined {
  const values: string[] = [];
  for (const property of event.signature.properties) {
    const value = scalarAt(event.data, property);
    if (value === undefined) {
      return undefined;
    }
    values.push(value);
  }
  return createHash('sha256')
    .update(`${values.join('')}${event.timestamp}${eventsSecret}`)
    .digest('hex');
}

@Injectable()
export class ChecksumGatewayEventVerifier implements GatewayEventVerifier {
  private readonly eventsSecret: string | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.eventsSecret = config.gateway.eventsSecret;
  }

  verify(event: GatewayEvent): boolean {
    if (!this.eventsSecret) {
      return false;
    }
    const expected = computeEventChecksum(event, this.eventsSecret);
    const received = event.signature.checksum.toLowerCase();
    if (expected === undefined || received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'));
  }
}
