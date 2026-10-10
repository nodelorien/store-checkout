import { buildIntegritySignature } from './integrity-signature';

describe('buildIntegritySignature', () => {
  it('AC-3: matches the vector published in the gateway documentation', () => {
    // Public documentation example, not a credential.
    const signature = buildIntegritySignature({
      reference: 'sk8-438k4-xmxm392-sn2m',
      amountInCents: 2490000,
      currency: 'COP',
      integritySecret: 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
    });

    expect(signature).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  it('AC-3: changes when any component changes', () => {
    const base = {
      reference: 'TX-20261009-ABCDEFGH',
      amountInCents: 14_040_000,
      currency: 'COP',
      integritySecret: 'test_integrity_secret',
    };
    const signature = buildIntegritySignature(base);

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(buildIntegritySignature({ ...base, amountInCents: 14_040_001 })).not.toBe(signature);
    expect(buildIntegritySignature({ ...base, reference: 'TX-20261009-ABCDEFGX' })).not.toBe(
      signature,
    );
    expect(buildIntegritySignature({ ...base, integritySecret: 'other' })).not.toBe(signature);
  });
});
