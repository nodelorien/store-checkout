import { Navigate, Route, Routes } from 'react-router-dom';
import { OrdersPage } from '@/features/account';
import { selectCheckoutStep } from '@/features/checkout';
import { InsightsPage } from '@/features/insights';
import { ProductsPage } from '@/features/products';
import { TransactionStatusPage, selectFlowTransactionId } from '@/features/transaction';
import { NotFoundPage } from '@/shared/ui/pages/NotFoundPage';
import { useAppSelector } from './hooks';

/**
 * Step 1 / 5. While the checkout is in the status step (a payment was made and its result has not
 * been acknowledged) the store sends the customer to the result — after paying and after a reload.
 */
function StoreRoute() {
  const step = useAppSelector(selectCheckoutStep);
  const transactionId = useAppSelector(selectFlowTransactionId);

  if (step === 'STATUS' && transactionId) {
    return <Navigate to={`/transactions/${encodeURIComponent(transactionId)}`} replace />;
  }
  return <ProductsPage />;
}

/** Route table. Checkout steps 2 and 3 are overlays on `/` driven by Redux, not routes. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StoreRoute />} />
      <Route path="/transactions/:id" element={<TransactionStatusPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
