import { z } from 'zod';
import { UNSUPPORTED_BRAND_MESSAGE, detectCardBrand } from './cardBrand';
import { CVC_LENGTH, isExpiryInFuture, onlyNumeric, parseExpiry } from './cardFormat';
import { isLuhnValid } from './luhn';

const CARD_NUMBER_MIN_LENGTH = 13;
const CARD_NUMBER_MAX_LENGTH = 19;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9]{7,15}$/;
const POSTAL_CODE = /^[A-Za-z0-9]{4,10}$/;

/**
 * Client-side card checks are UX only (catch typos before calling the gateway); the gateway is
 * the authority. `now` is injected so expiry rules are testable.
 */
export function createCardSchema(now: () => Date = () => new Date()) {
  return z.object({
    number: z
      .string()
      .min(1, 'Enter your card number')
      .superRefine((value, context) => {
        const numeric = onlyNumeric(value);
        if (numeric.length === 0) return;

        let message: string | null = null;
        if (detectCardBrand(numeric) === null) {
          message = UNSUPPORTED_BRAND_MESSAGE;
        } else if (
          numeric.length < CARD_NUMBER_MIN_LENGTH ||
          numeric.length > CARD_NUMBER_MAX_LENGTH
        ) {
          message = 'Card number looks incomplete';
        } else if (!isLuhnValid(numeric)) {
          message = 'Card number is not valid';
        }
        if (message) context.addIssue({ code: 'custom', message });
      }),
    holder: z
      .string()
      .trim()
      .min(1, 'Enter the name on the card')
      .min(5, 'Name on card must have at least 5 characters')
      .max(100, 'Name on card is too long'),
    expiry: z
      .string()
      .min(1, 'Enter the expiry date')
      .superRefine((value, context) => {
        const parsed = parseExpiry(value);
        if (!parsed) {
          context.addIssue({ code: 'custom', message: 'Use the format MM/YY' });
        } else if (!isExpiryInFuture(parsed, now())) {
          context.addIssue({ code: 'custom', message: 'This card has expired' });
        }
      }),
    cvc: z
      .string()
      .min(1, 'Enter the CVC')
      .regex(new RegExp(`^\\d{${CVC_LENGTH}}$`), `CVC must be ${CVC_LENGTH} numbers`),
  });
}

/** Same limits as the API's DTO validation (`docs/components/backend/api.md`). */
export const deliverySchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Enter your full name')
    .min(3, 'Full name must have at least 3 characters')
    .max(100, 'Full name is too long'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email')
    .max(254, 'Email is too long')
    .regex(EMAIL, 'Enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Enter your phone number')
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .refine((value) => PHONE.test(value), 'Enter a valid phone number, e.g. +573001234567'),
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Enter your address')
    .min(5, 'Address must have at least 5 characters')
    .max(120, 'Address is too long'),
  addressLine2: z.string().trim().max(120, 'This line is too long'),
  city: z
    .string()
    .trim()
    .min(1, 'Enter your city')
    .min(2, 'City must have at least 2 characters')
    .max(60, 'City is too long'),
  region: z
    .string()
    .trim()
    .min(1, 'Enter your region')
    .min(2, 'Region must have at least 2 characters')
    .max(60, 'Region is too long'),
  postalCode: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || POSTAL_CODE.test(value),
      'Postal code must be 4 to 10 letters or numbers',
    ),
});

export function createPaymentInfoSchema(now?: () => Date) {
  return z.object({
    card: createCardSchema(now),
    delivery: deliverySchema,
    acceptedTerms: z.boolean().refine((accepted) => accepted, 'You must accept the terms'),
  });
}

export type PaymentInfoFormValues = z.input<ReturnType<typeof createPaymentInfoSchema>>;
export type PaymentInfoFormOutput = z.output<ReturnType<typeof createPaymentInfoSchema>>;
