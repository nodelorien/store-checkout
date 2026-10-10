import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildPaymentConfig, buildProduct } from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { seedPaymentConfig, seedProducts } from '@/test/seed';
import { summaryState } from '@/test/states';
import { createAppStore } from '@/app/store';
import { checkoutDialogClosed, installmentsChanged, productSelected } from '../checkoutSlice';
import { buildTransactionBody } from '../confirmPayment';
import { selectInstallmentPlans } from '../selectors';
import { InstallmentsField, installmentLabel } from './InstallmentsField';

/** 100.000 + 2.500 + 8.000 = COP 110.500 */
async function storeWithTotal() {
  const store = createAppStore(summaryState());
  await seedProducts(store, [buildProduct({ priceInCents: 10_000_000 })]);
  await seedPaymentConfig(store, buildPaymentConfig());
  return store;
}

describe('instalments', () => {
  it('AC-1: offers each plan with the amount of one payment, rounded up to the peso', async () => {
    const store = await storeWithTotal();

    const plans = selectInstallmentPlans(store.getState());
    expect(plans.map((plan) => plan.installments)).toEqual([1, 2, 3, 6, 12, 24, 36]);
    expect(plans[0].perInstallmentInCents).toBe(11_050_000);
    // 110.500 / 3 = 36.833,33… → 36.834
    expect(plans[2].perInstallmentInCents).toBe(3_683_400);
    expect(plans[2].perInstallmentInCents * 3).toBeGreaterThanOrEqual(11_050_000);
  });

  it('AC-1: has no plans until the total is known', () => {
    expect(selectInstallmentPlans(createAppStore(summaryState()).getState())).toEqual([]);
    renderWithProviders(<InstallmentsField currency="COP" />, { preloadedState: summaryState() });
    expect(screen.queryByLabelText('Installments')).not.toBeInTheDocument();
  });

  it('AC-1: words a single payment differently from several', () => {
    expect(installmentLabel({ installments: 1, perInstallmentInCents: 11_050_000 }, 'COP')).toMatch(
      /^1 payment of \$\s?110\.500$/,
    );
    expect(installmentLabel({ installments: 12, perInstallmentInCents: 920_900 }, 'COP')).toMatch(
      /^12 payments of \$\s?9\.209$/,
    );
  });

  it('AC-2: choosing a plan is kept in the checkout and sent with the payment', async () => {
    const store = await storeWithTotal();
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<InstallmentsField currency="COP" />, { store });

    expect(screen.getByLabelText('Installments')).toHaveTextContent(/^1 payment of/);
    await user.click(screen.getByLabelText('Installments'));
    await user.click(within(screen.getByRole('listbox')).getByText(/^12 payments of/));

    const { checkout } = store.getState();
    expect(checkout.installments).toBe(12);
    const body = buildTransactionBody(
      checkout as Parameters<typeof buildTransactionBody>[0],
      buildPaymentConfig(),
    );
    expect(body.installments).toBe(12);
  });

  it('AC-2: a plan that is not offered falls back to a single payment', () => {
    const store = createAppStore(summaryState({ installments: 6 }));

    store.dispatch(installmentsChanged(5));
    expect(store.getState().checkout.installments).toBe(1);
  });

  it('AC-2: starting another purchase or leaving the checkout resets the plan', () => {
    const store = createAppStore(summaryState({ installments: 24 }));

    store.dispatch(productSelected('another-product'));
    expect(store.getState().checkout.installments).toBe(1);

    store.dispatch(installmentsChanged(6));
    store.dispatch(checkoutDialogClosed());
    expect(store.getState().checkout.installments).toBe(1);
  });

  it('AC-2: cannot be changed while the payment is being processed', async () => {
    const store = await storeWithTotal();
    renderWithProviders(<InstallmentsField currency="COP" disabled />, { store });

    expect(screen.getByLabelText('Installments')).toHaveAttribute('aria-disabled', 'true');
  });
});
