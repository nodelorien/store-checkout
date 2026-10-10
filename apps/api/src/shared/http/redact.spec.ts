import { redact, REDACTED, redactText } from './redact';

describe('redact', () => {
  it('AC-7: masks sensitive keys at any depth', () => {
    const input = {
      productId: 'p-1',
      quantity: 2,
      cardToken: 'tok_test_123',
      acceptanceToken: 'eyJ…',
      cardLastFour: '4242',
      customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
      delivery: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá', country: 'CO' },
      headers: [{ authorization: 'Bearer prv_x' }],
      signature: 'abc',
      privateKey: 'prv_x',
      integritySecret: 's',
    };

    expect(redact(input)).toEqual({
      productId: 'p-1',
      quantity: 2,
      cardToken: REDACTED,
      acceptanceToken: REDACTED,
      cardLastFour: REDACTED,
      customer: { fullName: REDACTED, email: REDACTED, phone: REDACTED },
      delivery: { addressLine1: REDACTED, city: REDACTED, country: 'CO' },
      headers: [{ authorization: REDACTED }],
      signature: REDACTED,
      privateKey: REDACTED,
      integritySecret: REDACTED,
    });
  });

  it('AC-7: masks emails and long digit runs inside free text', () => {
    expect(redactText('mail ada@example.com or call +57 300 123 4567 about 4242424242424242')).toBe(
      `mail ${REDACTED} or call ${REDACTED} about ${REDACTED}`,
    );
    expect(redact({ note: 'write to ada@example.com' })).toEqual({
      note: `write to ${REDACTED}`,
    });
  });

  it('AC-7: leaves harmless primitives untouched', () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(true)).toBe(true);
    expect(redact('status APPROVED')).toBe('status APPROVED');
  });

  it('AC-7: stops at a maximum depth instead of leaking deep values', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } };

    expect(JSON.stringify(redact(deep))).not.toContain('deep');
  });
});
