import { z } from 'zod';
import { CHECKOUT_STEPS, initialCheckoutState } from '@/features/checkout';
import { initialTransactionState } from '@/features/transaction';
import { TRANSACTION_STATUSES } from '@/shared/api/types';
import type { RootState } from '../rootReducer';

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const text = (max: number) => z.string().max(max);

const deliverySchema = z.object({
  fullName: text(200),
  email: text(320),
  phone: text(40),
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(120),
  region: text(120),
  postalCode: text(20),
});

const cardTokenSchema = z.object({
  tokenId: text(2048).min(1),
  brand: z.enum(['VISA', 'MASTERCARD']),
  lastFour: z.string().regex(/^\d{4}$/),
  expiresAt: text(40).min(1),
});

/** Unknown keys are stripped by Zod, so nothing outside this shape can be restored either. */
const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  savedAt: z.iso.datetime(),
  checkout: z.object({
    step: z.enum(CHECKOUT_STEPS),
    productId: text(100).nullable(),
    quantity: z.number().int().min(1).max(10),
    // Absent in snapshots saved before instalments existed.
    installments: z.number().int().min(1).max(36).default(1),
    delivery: deliverySchema.nullable(),
    card: cardTokenSchema.nullable(),
    acceptedTerms: z.boolean(),
    idempotencyKey: text(100).nullable(),
  }),
  transaction: z.object({
    id: text(100).nullable(),
    reference: text(100).nullable(),
    status: z.enum(TRANSACTION_STATUSES).nullable(),
  }),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type PersistedSlices = Pick<RootState, 'checkout' | 'transaction'>;

/**
 * Builds the persisted object field by field (allow-list). A new slice field is NOT persisted
 * until it is added here. Card number, CVC, expiry and holder name do not exist in the store, and
 * even if they were injected they could not get through this function.
 */
export function toSnapshot(state: PersistedSlices, now: Date = new Date()): Snapshot {
  const { checkout, transaction } = state;
  const { delivery, card } = checkout;

  return {
    version: SNAPSHOT_VERSION,
    savedAt: now.toISOString(),
    checkout: {
      step: checkout.step,
      productId: checkout.productId,
      quantity: checkout.quantity,
      installments: checkout.installments,
      delivery: delivery && {
        fullName: delivery.fullName,
        email: delivery.email,
        phone: delivery.phone,
        addressLine1: delivery.addressLine1,
        addressLine2: delivery.addressLine2,
        city: delivery.city,
        region: delivery.region,
        postalCode: delivery.postalCode,
      },
      card: card && {
        tokenId: card.tokenId,
        brand: card.brand,
        lastFour: card.lastFour,
        expiresAt: card.expiresAt,
      },
      acceptedTerms: checkout.acceptedTerms,
      idempotencyKey: checkout.idempotencyKey,
    },
    transaction: {
      id: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
    },
  };
}

/** Nothing worth keeping: the storage key is removed instead of saving this. */
export function isEmptySnapshot(snapshot: Snapshot): boolean {
  return (
    snapshot.checkout.step === 'PRODUCTS' &&
    snapshot.checkout.delivery === null &&
    snapshot.transaction.id === null
  );
}

function isConsistent({ checkout, transaction }: Snapshot): boolean {
  if (checkout.step === 'STATUS') return transaction.id !== null;
  if (checkout.step === 'PAYMENT_INFO' || checkout.step === 'SUMMARY') {
    return checkout.productId !== null;
  }
  return true;
}

/** Validates a stored value and returns the state to preload, or `undefined` to start clean. */
export function fromSnapshot(raw: unknown, now: Date = new Date()): PersistedSlices | undefined {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  const snapshot = parsed.data;
  const age = now.getTime() - Date.parse(snapshot.savedAt);
  if (age > SNAPSHOT_MAX_AGE_MS || !isConsistent(snapshot)) return undefined;

  return {
    checkout: { ...initialCheckoutState, ...snapshot.checkout },
    transaction: { ...initialTransactionState, ...snapshot.transaction },
  };
}
