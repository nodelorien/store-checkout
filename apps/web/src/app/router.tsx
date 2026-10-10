import { Route, Routes } from 'react-router-dom';
import { ProductsPage } from '@/features/products';
import { NotFoundPage } from '@/shared/components/NotFoundPage';

/** Route table. Checkout steps 2 and 3 are overlays on `/` driven by Redux, not routes. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProductsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
