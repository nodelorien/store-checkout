import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import type { Product } from '@/shared/api/types';
import { Money } from '@/shared/components/Money';
import { ResponsiveImage } from '@/shared/components/ResponsiveImage';
import { quantityChanged } from '../checkoutSlice';
import { selectMaxQuantity, selectQuantity } from '../selectors';
import { QuantityStepper } from './QuantityStepper';

interface OrderLineProps {
  product: Product;
  disabled?: boolean;
}

/** The product being bought, its unit price and the quantity control. */
export function OrderLine({ product, disabled = false }: OrderLineProps) {
  const dispatch = useAppDispatch();
  const quantity = useAppSelector(selectQuantity);
  const maxQuantity = useAppSelector(selectMaxQuantity);

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ width: 56, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden' }}>
        <ResponsiveImage src={product.imageUrl} alt="" priority="eager" />
      </Box>
      <Stack sx={{ flex: '1 1 96px', minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Money amountInCents={product.priceInCents} currency={product.currency} /> each
        </Typography>
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <QuantityStepper
          value={quantity}
          max={maxQuantity}
          disabled={disabled}
          onChange={(next) => dispatch(quantityChanged(next))}
        />
      </Box>
    </Stack>
  );
}
