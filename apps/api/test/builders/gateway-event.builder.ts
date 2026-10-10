import { createHash } from 'node:crypto';

export const EVENTS_SECRET = 'test_events_secret';

export interface EventOverrides {
  event?: string;
  transaction?: Record<string, unknown> | null;
  properties?: string[];
  timestamp?: number;
  secret?: string;
}

/**
 * Builds a gateway event the way the gateway does, signing it independently of the production
 * verifier (plain string concatenation), so tests do not validate the code with itself.
 */
export function aGatewayEvent(overrides: EventOverrides = {}): Record<string, unknown> {
  const transaction =
    overrides.transaction === null
      ? undefined
      : {
          id: 'gw-tx-1',
          amount_in_cents: 27_030_000,
          reference: 'TX-20261009-ABCDEFGH',
          customer_email: 'ada@example.com',
          currency: 'COP',
          payment_method_type: 'CARD',
          redirect_url: null,
          status: 'APPROVED',
          shipping_address: null,
          payment_link_id: null,
          payment_source_id: null,
          ...overrides.transaction,
        };
  const properties = overrides.properties ?? [
    'transaction.id',
    'transaction.status',
    'transaction.amount_in_cents',
  ];
  const timestamp = overrides.timestamp ?? 1_760_022_000;
  const signedValues = properties
    .map((property) => {
      const key = property.replace('transaction.', '');
      return String((transaction as Record<string, unknown> | undefined)?.[key] ?? '');
    })
    .join('');
  const checksum = createHash('sha256')
    .update(signedValues + String(timestamp) + (overrides.secret ?? EVENTS_SECRET))
    .digest('hex')
    .toUpperCase();

  return {
    event: overrides.event ?? 'transaction.updated',
    data: transaction ? { transaction } : {},
    environment: 'test',
    signature: { properties, checksum },
    timestamp,
    sent_at: '2026-10-09T15:00:06.000Z',
  };
}
