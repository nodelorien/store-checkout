import { useAppSelector } from '@/app/hooks';
import { selectCheckoutStep, selectSelectedProduct } from '../selectors';
import { CheckoutDialog } from './CheckoutDialog';

/**
 * Overlays of the checkout on top of the product page, driven by `checkout.step`:
 * step 2 (`PAYMENT_INFO`) is the dialog, step 3 (`SUMMARY`) the summary backdrop.
 * Nothing renders until the selected product is known (the catalogue may still be loading).
 */
export function CheckoutFlow() {
  const step = useAppSelector(selectCheckoutStep);
  const product = useAppSelector(selectSelectedProduct);

  if (!product || (step !== 'PAYMENT_INFO' && step !== 'SUMMARY')) return null;

  return <CheckoutDialog product={product} open={step === 'PAYMENT_INFO'} />;
}
