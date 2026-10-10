import { MASTERCARD_NUMBER, VISA_NUMBER } from '@/test/builders';
import { delivery } from '@/test/states';
import { createCardSchema, createPaymentInfoSchema, deliverySchema } from './schemas';

const now = () => new Date(2026, 9, 9);
const cardSchema = createCardSchema(now);

const validCard = {
  number: '4242 4242 4242 4242',
  holder: 'Ada Lovelace',
  expiry: '08/30',
  cvc: '123',
};

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe('card schema', () => {
  it.each([VISA_NUMBER, MASTERCARD_NUMBER, '5555 5555 5555 4444', '2223003122003222'])(
    'accepts the number %s',
    (number) => {
      expect(cardSchema.safeParse({ ...validCard, number }).success).toBe(true);
    },
  );

  it.each([
    ['', 'Enter your card number'],
    ['4242 4242 4242 4241', 'Card number is not valid'],
    ['4242 4242', 'Card number looks incomplete'],
    ['3782 822463 10005', 'Only VISA and MasterCard are accepted'],
    ['6011 1111 1111 1117', 'Only VISA and MasterCard are accepted'],
  ])('AC-3: rejects the number "%s" with "%s"', (number, message) => {
    expect(firstMessage(cardSchema.safeParse({ ...validCard, number }))).toBe(message);
  });

  it.each([
    ['', 'Enter the expiry date'],
    ['13/30', 'Use the format MM/YY'],
    ['1230', 'Use the format MM/YY'],
    ['09/26', 'This card has expired'],
    ['12/20', 'This card has expired'],
  ])('AC-4: rejects the expiry "%s" with "%s"', (expiry, message) => {
    expect(firstMessage(cardSchema.safeParse({ ...validCard, expiry }))).toBe(message);
  });

  it('AC-4: accepts a card expiring in the current month', () => {
    expect(cardSchema.safeParse({ ...validCard, expiry: '10/26' }).success).toBe(true);
  });

  it.each([
    ['', 'Enter the CVC'],
    ['12', 'CVC must be 3 numbers'],
    ['1234', 'CVC must be 3 numbers'],
    ['12a', 'CVC must be 3 numbers'],
  ])('AC-5: rejects the CVC "%s" with "%s"', (cvc, message) => {
    expect(firstMessage(cardSchema.safeParse({ ...validCard, cvc }))).toBe(message);
  });

  it.each([
    ['', 'Enter the name on the card'],
    ['Ada', 'Name on card must have at least 5 characters'],
    ['    Ada    ', 'Name on card must have at least 5 characters'],
    ['A'.repeat(101), 'Name on card is too long'],
  ])('AC-5: rejects the holder "%s" with "%s"', (holder, message) => {
    expect(firstMessage(cardSchema.safeParse({ ...validCard, holder }))).toBe(message);
  });

  it('uses the real clock by default', () => {
    expect(createCardSchema().safeParse({ ...validCard, expiry: '12/99' }).success).toBe(true);
  });
});

describe('delivery schema', () => {
  it('accepts valid delivery data', () => {
    expect(deliverySchema.safeParse(delivery)).toEqual({ success: true, data: delivery });
  });

  it('AC-6: accepts empty optional fields', () => {
    const result = deliverySchema.safeParse({ ...delivery, addressLine2: '', postalCode: '' });

    expect(result.success).toBe(true);
  });

  it('trims text and strips phone separators', () => {
    const result = deliverySchema.safeParse({
      ...delivery,
      fullName: '  Ada Lovelace ',
      phone: '+57 (300) 123-45.67',
    });

    expect(result.data).toMatchObject({ fullName: 'Ada Lovelace', phone: '+573001234567' });
  });

  it.each([
    ['fullName', '', 'Enter your full name'],
    ['fullName', 'Al', 'Full name must have at least 3 characters'],
    ['fullName', 'A'.repeat(101), 'Full name is too long'],
    ['email', '', 'Enter your email'],
    ['email', 'ada@example', 'Enter a valid email address'],
    ['email', 'ada example@mail.com', 'Enter a valid email address'],
    ['email', `${'a'.repeat(250)}@x.co`, 'Email is too long'],
    ['phone', '', 'Enter your phone number'],
    ['phone', '12345', 'Enter a valid phone number, e.g. +573001234567'],
    ['phone', 'phone-number', 'Enter a valid phone number, e.g. +573001234567'],
    ['addressLine1', '', 'Enter your address'],
    ['addressLine1', 'Cra', 'Address must have at least 5 characters'],
    ['addressLine1', 'A'.repeat(121), 'Address is too long'],
    ['addressLine2', 'A'.repeat(121), 'This line is too long'],
    ['city', '', 'Enter your city'],
    ['city', 'B', 'City must have at least 2 characters'],
    ['city', 'B'.repeat(61), 'City is too long'],
    ['region', '', 'Enter your region'],
    ['region', 'C', 'Region must have at least 2 characters'],
    ['region', 'C'.repeat(61), 'Region is too long'],
    ['postalCode', '123', 'Postal code must be 4 to 10 letters or numbers'],
    ['postalCode', '110-231', 'Postal code must be 4 to 10 letters or numbers'],
  ])('AC-6: %s "%s" → "%s"', (field, value, message) => {
    expect(firstMessage(deliverySchema.safeParse({ ...delivery, [field]: value }))).toBe(message);
  });
});

describe('payment info schema', () => {
  const schema = createPaymentInfoSchema(now);

  it('accepts a complete form', () => {
    expect(schema.safeParse({ card: validCard, delivery, acceptedTerms: true }).success).toBe(true);
  });

  it('AC-7: requires accepting the terms', () => {
    const result = schema.safeParse({ card: validCard, delivery, acceptedTerms: false });

    expect(firstMessage(result)).toBe('You must accept the terms');
  });
});
