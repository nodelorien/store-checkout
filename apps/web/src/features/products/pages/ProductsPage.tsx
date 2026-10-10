import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  CheckoutFlow,
  noticeDismissed,
  productSelected,
  selectPageNotice,
} from '@/features/checkout';
import { useGetProductsQuery } from '@/shared/api/baseApi';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export function ProductsPage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector(selectPageNotice);
  // Refetch whenever the page is shown again so stock is fresh after a purchase.
  const { data, error, isLoading, isFetching, refetch } = useGetProductsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const loading = isLoading || (isFetching && !data);

  return (
    <Stack spacing={{ xs: 2.5, md: 4 }}>
      <Stack spacing={0.5}>
        <Typography variant="h1" component="h2">
          Featured products
        </Typography>
        <Typography color="text.secondary">
          Hand-picked essentials, delivered to your door.
        </Typography>
      </Stack>

      {notice && (
        <Alert severity="info" onClose={() => dispatch(noticeDismissed())}>
          {notice}
        </Alert>
      )}

      {loading && (
        <>
          <Box role="status" sx={visuallyHidden}>
            Loading products…
          </Box>
          <ProductGridSkeleton />
        </>
      )}

      {!loading && error && !data && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        >
          We could not load the products. {error.message}
        </Alert>
      )}

      {!loading && data && data.length === 0 && (
        <Stack role="status" spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
          <Typography variant="h3">No products available</Typography>
          <Typography color="text.secondary">Please check back soon.</Typography>
        </Stack>
      )}

      {!loading && data && data.length > 0 && (
        <ProductGrid products={data} onPay={(productId) => dispatch(productSelected(productId))} />
      )}

      {/* Checkout steps 2 and 3 are overlays on this page. */}
      <CheckoutFlow />
    </Stack>
  );
}
