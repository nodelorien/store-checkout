import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VISA_NUMBER } from './builders';
import { delivery } from './states';

type User = ReturnType<typeof userEvent.setup>;

export const cardFields = {
  number: () => screen.getByLabelText('Card number'),
  holder: () => screen.getByLabelText('Name on card'),
  expiry: () => screen.getByLabelText('Expiry date'),
  cvc: () => screen.getByLabelText('CVC'),
};

export const deliveryFields = {
  fullName: () => screen.getByLabelText('Full name'),
  email: () => screen.getByLabelText('Email'),
  phone: () => screen.getByLabelText('Phone'),
  addressLine1: () => screen.getByLabelText('Address'),
  addressLine2: () => screen.getByLabelText('Apartment, suite (optional)'),
  city: () => screen.getByLabelText('City'),
  region: () => screen.getByLabelText('Region'),
  postalCode: () => screen.getByLabelText('Postal code (optional)'),
};

export const termsCheckbox = () => screen.getByRole('checkbox', { name: /I accept the terms/ });
export const continueButton = () => screen.getByRole('button', { name: 'Continue to summary' });

export async function fillCard(
  user: User,
  { number = VISA_NUMBER, holder = 'Ada Lovelace', expiry = '0830', cvc = '123' } = {},
) {
  await user.type(cardFields.number(), number);
  await user.type(cardFields.holder(), holder);
  await user.type(cardFields.expiry(), expiry);
  await user.type(cardFields.cvc(), cvc);
}

export async function fillDelivery(user: User, values = delivery) {
  await user.type(deliveryFields.fullName(), values.fullName);
  await user.type(deliveryFields.email(), values.email);
  await user.type(deliveryFields.phone(), values.phone);
  await user.type(deliveryFields.addressLine1(), values.addressLine1);
  if (values.addressLine2) await user.type(deliveryFields.addressLine2(), values.addressLine2);
  await user.type(deliveryFields.city(), values.city);
  await user.type(deliveryFields.region(), values.region);
  if (values.postalCode) await user.type(deliveryFields.postalCode(), values.postalCode);
}

/** Fills card + delivery, accepts the terms and submits the payment-info step. */
export async function completePaymentInfo(user: User, card?: Parameters<typeof fillCard>[1]) {
  await fillCard(user, card);
  await fillDelivery(user);
  await user.click(termsCheckbox());
  await user.click(continueButton());
}
