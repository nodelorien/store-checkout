import type { RootState } from '@/app/store';
import {
  initialCheckoutState,
  type CheckoutState,
  type DeliveryInfo,
  type TokenizedCard,
} from '@/features/checkout';
import { initialTransactionState, type TransactionState } from '@/features/transaction';
import { PRODUCT_ID, TRANSACTION_ID } from './builders';

export const delivery: DeliveryInfo = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+573001234567',
  addressLine1: 'Cra 7 # 71-21',
  addressLine2: 'Apto 501',
  city: 'Bogota',
  region: 'Cundinamarca',
  postalCode: '110231',
};

export const tokenizedCard: TokenizedCard = {
  tokenId: 'tok_test_123',
  brand: 'VISA',
  lastFour: '4242',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

export const IDEMPOTENCY_KEY = '11111111-1111-4111-8111-111111111111';

type Slices = Pick<RootState, 'checkout' | 'transaction'>;

export function checkoutState(overrides: Partial<CheckoutState> = {}): CheckoutState {
  return { ...initialCheckoutState, ...overrides };
}

export function paymentInfoState(overrides: Partial<CheckoutState> = {}): Slices {
  return {
    checkout: checkoutState({ step: 'PAYMENT_INFO', productId: PRODUCT_ID, ...overrides }),
    transaction: initialTransactionState,
  };
}

export function summaryState(overrides: Partial<CheckoutState> = {}): Slices {
  return {
    checkout: checkoutState({
      step: 'SUMMARY',
      productId: PRODUCT_ID,
      delivery,
      card: tokenizedCard,
      acceptedTerms: true,
      idempotencyKey: IDEMPOTENCY_KEY,
      ...overrides,
    }),
    transaction: initialTransactionState,
  };
}

export function statusState(overrides: Partial<TransactionState> = {}): Slices {
  return {
    checkout: checkoutState({
      step: 'STATUS',
      productId: PRODUCT_ID,
      delivery,
      card: tokenizedCard,
      acceptedTerms: true,
      idempotencyKey: IDEMPOTENCY_KEY,
    }),
    transaction: {
      ...initialTransactionState,
      id: TRANSACTION_ID,
      reference: 'TX-20261009-7K2M9QXA',
      status: 'APPROVED',
      ...overrides,
    },
  };
}
