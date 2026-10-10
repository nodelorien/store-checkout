import type { Middleware } from '@reduxjs/toolkit';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createAppStore } from '@/app/store';
import { createActionRecorder } from '@/test/actionRecorder';
import {
  API_URL,
  GATEWAY_TOKENIZATION_URL,
  MASTERCARD_NUMBER,
  PRODUCT_ID,
  VISA_NUMBER,
  buildCatalogue,
  buildGatewayTokenResponse,
  buildProduct,
  errorEnvelope,
} from '@/test/builders';
import {
  cardFields,
  completePaymentInfo,
  continueButton,
  deliveryFields,
  fillCard,
  fillDelivery,
  termsCheckbox,
} from '@/test/checkoutForm';
import { renderWithProviders } from '@/test/renderWithProviders';
import { seedProducts } from '@/test/seed';
import { server } from '@/test/server';
import { delivery, paymentInfoState } from '@/test/states';
import { paymentInfoEditRequested } from '../checkoutSlice';
import { CheckoutFlow } from './CheckoutFlow';

async function renderDialog(
  preloaded = paymentInfoState(),
  { products = buildCatalogue(), extraMiddleware = [] as Middleware[] } = {},
) {
  const store = createAppStore(preloaded, { extraMiddleware });
  await seedProducts(store, products);
  const user = userEvent.setup({ delay: null });
  const view = renderWithProviders(<CheckoutFlow />, { store });
  const dialog = await screen.findByRole('dialog', { name: 'Checkout' });
  return { user, dialog, ...view };
}

const helperTextOf = (input: HTMLElement) =>
  document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent;

describe('CheckoutDialog', () => {
  it('AC-1: shows the selected product, its price and the card and delivery sections', async () => {
    const { dialog } = await renderDialog();

    expect(within(dialog).getByText('Aurora Desk Lamp')).toBeInTheDocument();
    expect(within(dialog).getByText(/129\.900/)).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Card details' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Delivery details' })).toBeInTheDocument();
    expect(continueButton()).toBeInTheDocument();
  });

  it('renders nothing when no product is selected', async () => {
    const store = createAppStore();
    await seedProducts(store);
    renderWithProviders(<CheckoutFlow />, { store });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the right input types, autocomplete tokens and keyboards', async () => {
    await renderDialog();

    expect(cardFields.number()).toHaveAttribute('autocomplete', 'cc-number');
    expect(cardFields.number()).toHaveAttribute('inputmode', 'numeric');
    expect(cardFields.holder()).toHaveAttribute('autocomplete', 'cc-name');
    expect(cardFields.expiry()).toHaveAttribute('autocomplete', 'cc-exp');
    expect(cardFields.cvc()).toHaveAttribute('autocomplete', 'cc-csc');
    expect(cardFields.cvc()).toHaveAttribute('type', 'password');
    expect(deliveryFields.fullName()).toHaveAttribute('autocomplete', 'name');
    expect(deliveryFields.email()).toHaveAttribute('type', 'email');
    expect(deliveryFields.phone()).toHaveAttribute('autocomplete', 'tel');
    expect(deliveryFields.addressLine1()).toHaveAttribute('autocomplete', 'address-line1');
    expect(deliveryFields.city()).toHaveAttribute('autocomplete', 'address-level2');
    expect(deliveryFields.region()).toHaveAttribute('autocomplete', 'address-level1');
    expect(deliveryFields.postalCode()).toHaveAttribute('autocomplete', 'postal-code');
  });

  it('AC-2: switches between the VISA and MasterCard logos while typing', async () => {
    const { user } = await renderDialog();
    const number = cardFields.number();

    expect(screen.getByRole('img', { name: 'Card' })).toBeInTheDocument();

    await user.type(number, '4');
    expect(screen.getByRole('img', { name: 'VISA' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Card' })).not.toBeInTheDocument();

    await user.clear(number);
    await user.type(number, '5');
    expect(screen.getByRole('img', { name: 'Card' })).toBeInTheDocument();
    await user.type(number, '5');
    expect(screen.getByRole('img', { name: 'MasterCard' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'VISA' })).not.toBeInTheDocument();

    await user.clear(number);
    await user.type(number, '2221');
    expect(screen.getByRole('img', { name: 'MasterCard' })).toBeInTheDocument();
  });

  it('AC-2: tells the user when the brand is not accepted', async () => {
    const { user } = await renderDialog();

    await user.type(cardFields.number(), '3782');

    expect(screen.getByRole('img', { name: 'Card' })).toBeInTheDocument();
    expect(cardFields.number()).toBeInvalid();
    expect(helperTextOf(cardFields.number())).toBe('Only VISA and MasterCard are accepted');
  });

  it('groups the card number in fours and formats the expiry', async () => {
    const { user } = await renderDialog();

    await user.type(cardFields.number(), MASTERCARD_NUMBER);
    await user.type(cardFields.expiry(), '0830');
    await user.type(cardFields.cvc(), '12345');

    expect(cardFields.number()).toHaveValue('5555 5555 5555 4444');
    expect(cardFields.expiry()).toHaveValue('08/30');
    expect(cardFields.cvc()).toHaveValue('123');
  });

  it('AC-3: rejects a number that fails the Luhn check', async () => {
    const { user } = await renderDialog();

    await user.type(cardFields.number(), '4242424242424241');
    await user.tab();

    expect(cardFields.number()).toBeInvalid();
    expect(helperTextOf(cardFields.number())).toBe('Card number is not valid');
  });

  it('AC-4: rejects an expired date', async () => {
    const { user } = await renderDialog();

    await user.type(cardFields.expiry(), '0120');
    await user.tab();

    expect(cardFields.expiry()).toBeInvalid();
    expect(helperTextOf(cardFields.expiry())).toBe('This card has expired');
  });

  it('AC-5 AC-6 AC-7: submitting an empty form shows every validation message', async () => {
    const { user, store } = await renderDialog();
    await waitFor(() => expect(continueButton()).toBeEnabled());

    await user.click(continueButton());

    expect(await screen.findByText('Please review the highlighted fields.')).toBeInTheDocument();
    expect(helperTextOf(cardFields.number())).toBe('Enter your card number');
    expect(helperTextOf(cardFields.holder())).toBe('Enter the name on the card');
    expect(helperTextOf(cardFields.expiry())).toBe('Enter the expiry date');
    expect(helperTextOf(cardFields.cvc())).toBe('Enter the CVC');
    expect(helperTextOf(deliveryFields.fullName())).toBe('Enter your full name');
    expect(helperTextOf(deliveryFields.email())).toBe('Enter your email');
    expect(helperTextOf(deliveryFields.phone())).toBe('Enter your phone number');
    expect(helperTextOf(deliveryFields.addressLine1())).toBe('Enter your address');
    expect(helperTextOf(deliveryFields.city())).toBe('Enter your city');
    expect(helperTextOf(deliveryFields.region())).toBe('Enter your region');
    expect(deliveryFields.addressLine2()).toBeValid();
    expect(deliveryFields.postalCode()).toBeValid();
    expect(screen.getByText('You must accept the terms')).toBeInTheDocument();
    expect(termsCheckbox()).toBeInvalid();
    expect(cardFields.number()).toHaveFocus();
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
  });

  it('AC-6: shows delivery format errors when leaving a field', async () => {
    const { user } = await renderDialog();

    await user.type(deliveryFields.email(), 'ada@example');
    await user.type(deliveryFields.phone(), '12345');
    await user.type(deliveryFields.postalCode(), '12');
    await user.tab();

    expect(helperTextOf(deliveryFields.email())).toBe('Enter a valid email address');
    expect(helperTextOf(deliveryFields.phone())).toBe(
      'Enter a valid phone number, e.g. +573001234567',
    );
    expect(helperTextOf(deliveryFields.postalCode())).toBe(
      'Postal code must be 4 to 10 letters or numbers',
    );
  });

  it('AC-7: the terms checkbox links to the acceptance permalink', async () => {
    await renderDialog();

    const link = await screen.findByRole('link', { name: 'terms and conditions' });
    expect(link).toHaveAttribute('href', 'https://gateway.test/terms.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('AC-8: tokenizes with the gateway and moves to the summary keeping only the token', async () => {
    let gatewayRequest: { authorization: string | null; body: unknown } | undefined;
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, async ({ request }) => {
        gatewayRequest = {
          authorization: request.headers.get('Authorization'),
          body: await request.json(),
        };
        return HttpResponse.json(buildGatewayTokenResponse(), { status: 201 });
      }),
    );
    const { user, store } = await renderDialog();

    await completePaymentInfo(user, { holder: '  Ada Lovelace ' });

    await waitFor(() => expect(store.getState().checkout.step).toBe('SUMMARY'));
    expect(gatewayRequest).toEqual({
      authorization: 'Bearer pub_test_key',
      body: {
        number: VISA_NUMBER,
        cvc: '123',
        exp_month: '08',
        exp_year: '30',
        card_holder: 'Ada Lovelace',
      },
    });
    expect(store.getState().checkout).toMatchObject({
      card: { tokenId: 'tok_test_123', brand: 'VISA', lastFour: '4242' },
      delivery,
      acceptedTerms: true,
    });
    expect(store.getState().checkout.idempotencyKey).toEqual(expect.any(String));
  });

  it('AC-9: typing and submitting never puts card data in the state or in an action', async () => {
    const recorder = createActionRecorder();
    const { user, store } = await renderDialog(paymentInfoState(), {
      extraMiddleware: [recorder.middleware],
    });

    await completePaymentInfo(user, { holder: 'Ada Holder Lovelace' });
    await waitFor(() => expect(store.getState().checkout.step).toBe('SUMMARY'));

    const everything = [...recorder.actions, JSON.stringify(store.getState())].join('\n');
    expect(everything).not.toContain(VISA_NUMBER);
    expect(everything).not.toContain('4242 4242 4242 4242');
    expect(everything).not.toContain('Ada Holder Lovelace');
    expect(everything).not.toContain('08/30');
    expect(everything).not.toMatch(/"(number|cvc|expiry|holder|exp_month|exp_year)"/);
  });

  it('AC-10: shows our own message when the gateway rejects the card and allows a retry', async () => {
    server.use(
      http.post(
        GATEWAY_TOKENIZATION_URL,
        () =>
          HttpResponse.json(
            {
              error: { type: 'INPUT_VALIDATION_ERROR', messages: { number: ['Número inválido'] } },
            },
            { status: 422 },
          ),
        { once: true },
      ),
    );
    const { user, store } = await renderDialog();

    await completePaymentInfo(user);

    expect(
      await screen.findByText('We could not validate your card. Check the details and try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/inválido/)).not.toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
    expect(cardFields.number()).toHaveValue('4242 4242 4242 4242');

    await user.click(continueButton());

    await waitFor(() => expect(store.getState().checkout.step).toBe('SUMMARY'));
  });

  it('AC-10: shows a connection error when the gateway is unreachable', async () => {
    server.use(http.post(GATEWAY_TOKENIZATION_URL, () => HttpResponse.error()));
    const { user, store } = await renderDialog();

    await completePaymentInfo(user);

    expect(await screen.findByText(/We could not reach the server/)).toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');
  });

  it('AC-11: changes the quantity within the allowed range', async () => {
    const { user, store } = await renderDialog(paymentInfoState(), {
      products: [buildProduct({ stock: 2 })],
    });
    const decrease = screen.getByRole('button', { name: 'Decrease quantity' });
    const increase = screen.getByRole('button', { name: 'Increase quantity' });

    expect(decrease).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Quantity: 1' })).toBeInTheDocument();

    await user.click(increase);

    expect(store.getState().checkout.quantity).toBe(2);
    expect(screen.getByRole('status', { name: 'Quantity: 2' })).toBeInTheDocument();
    expect(increase).toBeDisabled();

    await user.click(decrease);
    expect(store.getState().checkout.quantity).toBe(1);
  });

  it('AC-12: closing returns to the products and keeps the delivery draft', async () => {
    const { user, store } = await renderDialog();

    await fillCard(user);
    await user.type(deliveryFields.fullName(), 'Ada Lovelace');
    await user.click(termsCheckbox());
    await user.click(screen.getByRole('button', { name: 'Close checkout' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(store.getState().checkout).toMatchObject({
      step: 'PRODUCTS',
      productId: null,
      delivery: { fullName: 'Ada Lovelace', email: '' },
      acceptedTerms: true,
    });
    expect(JSON.stringify(store.getState())).not.toContain(VISA_NUMBER);
  });

  it('AC-12: prefills the delivery draft when the dialog opens again', async () => {
    await renderDialog(paymentInfoState({ delivery, acceptedTerms: true }));

    expect(deliveryFields.fullName()).toHaveValue('Ada Lovelace');
    expect(deliveryFields.city()).toHaveValue('Bogota');
    expect(termsCheckbox()).toBeChecked();
    expect(cardFields.number()).toHaveValue('');
  });

  it('AC-13: disables the form actions while tokenizing', async () => {
    server.use(
      http.post(GATEWAY_TOKENIZATION_URL, async () => {
        await delay(80);
        return HttpResponse.json(buildGatewayTokenResponse(), { status: 201 });
      }),
    );
    const { user, store } = await renderDialog();

    await completePaymentInfo(user);

    await waitFor(() => expect(store.getState().checkout.submission.status).toBe('tokenizing'));
    expect(continueButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close checkout' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(store.getState().checkout.step).toBe('PAYMENT_INFO');

    await waitFor(() => expect(store.getState().checkout.step).toBe('SUMMARY'));
  });

  it('AC-14: explains when the payment settings cannot be loaded and recovers on retry', async () => {
    server.use(
      http.get(
        `${API_URL}/payment-config`,
        () => HttpResponse.json(errorEnvelope('PAYMENT_GATEWAY_UNAVAILABLE'), { status: 502 }),
        { once: true },
      ),
    );
    const { user } = await renderDialog();

    const alert = (await screen.findByText('We could not load the payment settings.')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(continueButton()).toBeDisabled();

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(continueButton()).toBeEnabled());
    expect(screen.queryByText('We could not load the payment settings.')).not.toBeInTheDocument();
  });

  it('shows and dismisses the notice asking to re-enter the card', async () => {
    const { user, store } = await renderDialog(
      paymentInfoState({ notice: 'Please re-enter your card' }),
    );

    expect(screen.getByText('Please re-enter your card')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(store.getState().checkout.notice).toBeNull();
  });

  it('keeps the card typed so far when coming back from the summary to edit', async () => {
    const { user, store } = await renderDialog();
    await fillDelivery(user);
    await fillCard(user);
    await user.click(termsCheckbox());
    await user.click(continueButton());
    expect(await screen.findByRole('dialog', { name: 'Order summary' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Checkout' })).not.toBeInTheDocument();

    act(() => {
      store.dispatch(paymentInfoEditRequested());
    });

    expect(await screen.findByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
    expect(cardFields.number()).toHaveValue('4242 4242 4242 4242');
    expect(store.getState().checkout.productId).toBe(PRODUCT_ID);
  });
});
