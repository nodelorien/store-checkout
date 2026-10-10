import { aGatewayEvent, EVENTS_SECRET } from '../../../../../test/builders/gateway-event.builder';
import { expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { GatewayEvent } from '../../application/ports/gateway-event-verifier.port';
import { parseGatewayEvent } from '../../application/use-cases/handle-gateway-event.use-case';
import {
  ChecksumGatewayEventVerifier,
  computeEventChecksum,
} from './checksum-gateway-event.verifier';

const verifier = new ChecksumGatewayEventVerifier(testConfig());
const parsed = (raw: Record<string, unknown>): GatewayEvent => expectOk(parseGatewayEvent(raw));

describe('computeEventChecksum', () => {
  // Same event as the gateway documentation example: the signed string is
  // "1234-1610641025-49201" + "APPROVED" + "4490000" + "1530291411" + secret.
  const documented: GatewayEvent = {
    event: 'transaction.updated',
    data: {
      transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 },
    },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: 'unused',
    },
    timestamp: 1530291411,
  };

  it('AC-4: hashes the signed values, the timestamp and the secret, in that order', () => {
    expect(computeEventChecksum(documented, EVENTS_SECRET)).toBe(
      '82d7b6fae35f0de10bb9186be459d13d54d3752c4def83a41fb8ceea85b53633',
    );
  });

  it('AC-4: follows the property order given by the event', () => {
    const reordered = {
      ...documented,
      signature: { ...documented.signature, properties: ['transaction.status', 'transaction.id'] },
    };

    expect(computeEventChecksum(reordered, EVENTS_SECRET)).not.toBe(
      computeEventChecksum(documented, EVENTS_SECRET),
    );
  });

  it.each([
    ['a missing leaf', ['transaction.nope']],
    ['a missing branch', ['other.id']],
    ['an object instead of a scalar', ['transaction']],
    ['an inherited property', ['transaction.constructor']],
    ['a path through a scalar', ['transaction.id.length']],
  ])('AC-4: yields no checksum for %s', (_name, properties) => {
    const event = { ...documented, signature: { ...documented.signature, properties } };

    expect(computeEventChecksum(event, EVENTS_SECRET)).toBeUndefined();
  });
});

describe('ChecksumGatewayEventVerifier', () => {
  it('AC-4: accepts an authentic event, whatever the checksum casing', () => {
    const event = parsed(aGatewayEvent());
    const lowerCased = {
      ...event,
      signature: { ...event.signature, checksum: event.signature.checksum.toLowerCase() },
    };

    expect(verifier.verify(event)).toBe(true);
    expect(verifier.verify(lowerCased)).toBe(true);
  });

  it('AC-3: rejects an event signed with another secret', () => {
    expect(verifier.verify(parsed(aGatewayEvent({ secret: 'attacker-secret' })))).toBe(false);
  });

  it('AC-3: rejects a tampered signed value', () => {
    const event = parsed(aGatewayEvent({ transaction: { status: 'DECLINED' } }));
    const tampered: GatewayEvent = {
      ...event,
      data: { transaction: { ...(event.data.transaction as object), status: 'APPROVED' } },
    };

    expect(verifier.verify(tampered)).toBe(false);
  });

  it('AC-3: rejects a tampered timestamp and a checksum of another length', () => {
    const event = parsed(aGatewayEvent());

    expect(verifier.verify({ ...event, timestamp: event.timestamp + 1 })).toBe(false);
    expect(verifier.verify({ ...event, signature: { ...event.signature, checksum: 'abc' } })).toBe(
      false,
    );
  });

  it('AC-3: rejects an event whose signed property does not exist', () => {
    const event = parsed(aGatewayEvent());

    expect(
      verifier.verify({
        ...event,
        signature: { ...event.signature, properties: ['transaction.missing'] },
      }),
    ).toBe(false);
  });

  it('AC-3: rejects everything when no events secret is configured', () => {
    const base = testConfig();
    const withoutSecret = new ChecksumGatewayEventVerifier({
      ...base,
      gateway: { ...base.gateway, eventsSecret: undefined },
    });

    expect(withoutSecret.verify(parsed(aGatewayEvent()))).toBe(false);
  });
});
