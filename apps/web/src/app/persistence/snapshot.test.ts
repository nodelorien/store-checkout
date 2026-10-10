import { initialCheckoutState } from '@/features/checkout';
import { initialTransactionState } from '@/features/transaction';
import { createUiError } from '@/shared/api/uiError';
import { MASTERCARD_NUMBER, PRODUCT_ID, VISA_NUMBER } from '@/test/builders';
import { paymentInfoState, statusState, summaryState } from '@/test/states';
import {
  SNAPSHOT_MAX_AGE_MS,
  fromSnapshot,
  isEmptySnapshot,
  toSnapshot,
  type PersistedSlices,
} from './snapshot';

const NOW = new Date('2026-10-09T15:00:00.000Z');

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

describe('toSnapshot', () => {
  it('AC-5: contains exactly the allow-listed fields', () => {
    const snapshot = toSnapshot(statusState(), NOW);

    expect(snapshot).toEqual({
      version: 1,
      savedAt: '2026-10-09T15:00:00.000Z',
      checkout: {
        step: 'STATUS',
        productId: PRODUCT_ID,
        quantity: 1,
        installments: 1,
        delivery: statusState().checkout.delivery,
        card: {
          tokenId: 'tok_test_123',
          brand: 'VISA',
          lastFour: '4242',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        acceptedTerms: true,
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
      transaction: {
        id: statusState().transaction.id,
        reference: 'TX-20261009-7K2M9QXA',
        status: 'APPROVED',
      },
    });
  });

  it('AC-5: never persists submission, notice or polling', () => {
    const state = summaryState({
      notice: 'A notice',
      submission: { status: 'failed', error: createUiError('NETWORK_ERROR') },
    });
    const keys = collectKeys(toSnapshot(state, NOW));

    expect(keys).not.toEqual(expect.arrayContaining(['submission']));
    expect(keys).not.toEqual(expect.arrayContaining(['notice']));
    expect(keys).not.toEqual(expect.arrayContaining(['polling']));
    expect(keys).not.toEqual(expect.arrayContaining(['api']));
  });

  it('AC-5: card number, CVC, expiry and holder can never appear, even if injected into state', () => {
    const clean = summaryState();
    // Simulate a future bug that leaks card fields into every level of the persisted slices.
    const leaked = {
      number: VISA_NUMBER,
      cardNumber: MASTERCARD_NUMBER,
      cvc: '987',
      cvv: '987',
      expMonth: '08',
      expYear: '30',
      exp_month: '08',
      exp_year: '30',
      expiry: '08/30',
      holder: 'ADA LOVELACE HOLDER',
      cardHolder: 'ADA LOVELACE HOLDER',
      card_holder: 'ADA LOVELACE HOLDER',
      acceptanceToken: 'acceptance-token-123',
    };
    const polluted = {
      checkout: {
        ...clean.checkout,
        ...leaked,
        card: { ...clean.checkout.card, ...leaked },
        delivery: { ...clean.checkout.delivery, ...leaked },
        cardForm: leaked,
      },
      transaction: { ...clean.transaction, ...leaked },
    } as unknown as PersistedSlices;

    const snapshot = toSnapshot(polluted, NOW);
    const serialised = JSON.stringify(snapshot);
    const keys = collectKeys(snapshot);

    for (const forbidden of Object.keys(leaked)) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys.filter((key) => /number|cvc|cvv|holder|^exp(?!iresAt$)/i.test(key))).toEqual([]);
    expect(serialised).not.toContain(VISA_NUMBER);
    expect(serialised).not.toContain(MASTERCARD_NUMBER);
    expect(serialised).not.toContain('987');
    expect(serialised).not.toContain('08/30');
    expect(serialised).not.toContain('HOLDER');
    expect(serialised).not.toContain('acceptance-token-123');
  });

  it('recognises a snapshot with nothing worth keeping', () => {
    const empty = { checkout: initialCheckoutState, transaction: initialTransactionState };

    expect(isEmptySnapshot(toSnapshot(empty, NOW))).toBe(true);
    expect(isEmptySnapshot(toSnapshot(paymentInfoState(), NOW))).toBe(false);
    expect(isEmptySnapshot(toSnapshot(statusState(), NOW))).toBe(false);
  });
});

describe('fromSnapshot', () => {
  it('restores the persisted slices with non-persisted fields at their defaults', () => {
    const state = summaryState({
      notice: 'dropped',
      submission: { status: 'paying', error: null },
    });

    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(state, NOW))), NOW);

    expect(restored).toEqual({
      checkout: { ...state.checkout, notice: null, submission: { status: 'idle', error: null } },
      transaction: initialTransactionState,
    });
  });

  it('strips unknown keys when restoring', () => {
    const raw = JSON.parse(JSON.stringify(toSnapshot(summaryState(), NOW)));
    raw.checkout.card.number = VISA_NUMBER;
    raw.checkout.cvc = '123';

    const restored = fromSnapshot(raw, NOW);

    expect(JSON.stringify(restored)).not.toContain(VISA_NUMBER);
    expect(restored?.checkout).not.toHaveProperty('cvc');
  });

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'checkout'],
    ['an empty object', {}],
  ])('AC-6: discards %s', (_label, raw) => {
    expect(fromSnapshot(raw, NOW)).toBeUndefined();
  });

  const valid = () => JSON.parse(JSON.stringify(toSnapshot(summaryState(), NOW)));

  it('AC-6: discards another version', () => {
    expect(fromSnapshot({ ...valid(), version: 2 }, NOW)).toBeUndefined();
  });

  it('AC-6: discards a snapshot older than 24 hours and keeps a newer one', () => {
    const justInside = new Date(NOW.getTime() + SNAPSHOT_MAX_AGE_MS);
    const justOutside = new Date(NOW.getTime() + SNAPSHOT_MAX_AGE_MS + 1);

    expect(fromSnapshot(valid(), justInside)).toBeDefined();
    expect(fromSnapshot(valid(), justOutside)).toBeUndefined();
  });

  it.each([
    ['an unknown step', (s: ReturnType<typeof valid>) => (s.checkout.step = 'PAID')],
    ['a non-integer quantity', (s: ReturnType<typeof valid>) => (s.checkout.quantity = 1.5)],
    ['a quantity above the limit', (s: ReturnType<typeof valid>) => (s.checkout.quantity = 11)],
    ['an unknown card brand', (s: ReturnType<typeof valid>) => (s.checkout.card.brand = 'AMEX')],
    ['a malformed last four', (s: ReturnType<typeof valid>) => (s.checkout.card.lastFour = '42')],
    ['an invalid date', (s: ReturnType<typeof valid>) => (s.savedAt = 'yesterday')],
    ['an unknown status', (s: ReturnType<typeof valid>) => (s.transaction.status = 'PAID')],
    ['a missing section', (s: ReturnType<typeof valid>) => delete s.transaction],
  ])('AC-6: discards %s', (_label, corrupt) => {
    const raw = valid();
    corrupt(raw);

    expect(fromSnapshot(raw, NOW)).toBeUndefined();
  });

  it('AC-6: discards an overlay step without a product', () => {
    const raw = valid();
    raw.checkout.productId = null;

    expect(fromSnapshot(raw, NOW)).toBeUndefined();
  });

  it('AC-6: discards a status step without a transaction', () => {
    const raw = JSON.parse(JSON.stringify(toSnapshot(statusState(), NOW)));
    raw.transaction.id = null;

    expect(fromSnapshot(raw, NOW)).toBeUndefined();
  });

  it('accepts the products step with only a delivery draft', () => {
    const state = paymentInfoState({ step: 'PRODUCTS', productId: null });
    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(state, NOW))), NOW);

    expect(restored?.checkout.step).toBe('PRODUCTS');
  });
});

describe('instalments in the snapshot', () => {
  it('AC-2: keeps the chosen instalments across a reload', () => {
    const state = statusState();
    const saved = toSnapshot({ ...state, checkout: { ...state.checkout, installments: 12 } }, NOW);

    expect(fromSnapshot(saved, NOW)?.checkout.installments).toBe(12);
  });

  it('AC-2: restores a snapshot saved before instalments existed as a single payment', () => {
    const { checkout, ...rest } = toSnapshot(statusState(), NOW);
    const legacyCheckout: Partial<typeof checkout> = { ...checkout };
    delete legacyCheckout.installments;

    expect(fromSnapshot({ ...rest, checkout: legacyCheckout }, NOW)?.checkout.installments).toBe(1);
  });
});
