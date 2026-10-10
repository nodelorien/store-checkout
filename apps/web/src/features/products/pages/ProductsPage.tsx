import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  CheckoutFlow,
  noticeDismissed,
  productSelected,
  selectPageNotice,
} from '@/features/checkout';
import { useGetProductsQuery } from '@/shared/api/baseApi';
import { Catalogue } from '../components/Catalogue';
import { StoreHero } from '../components/StoreHero';

export function ProductsPage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector(selectPageNotice);
  // The checkout joins the selected product with the whole catalogue (stock, price), so it is
  // kept in the cache and refreshed whenever the page is shown again. The list below pages.
  const all = useGetProductsQuery(undefined, { refetchOnMountOrArgChange: true });

  return (
    <Stack spacing={{ xs: 2.5, md: 4 }}>
      <StoreHero />

      {notice && (
        <Alert severity="info" onClose={() => dispatch(noticeDismissed())}>
          {notice}
        </Alert>
      )}

      <Catalogue
        onPay={(productId) => dispatch(productSelected(productId))}
        checkoutData={{
          failed: all.isError && !all.data,
          message: all.error?.message,
          retry: () => void all.refetch(),
        }}
      />

      {/* Checkout steps 2 and 3 are overlays on this page. */}
      <CheckoutFlow />
    </Stack>
  );
}
