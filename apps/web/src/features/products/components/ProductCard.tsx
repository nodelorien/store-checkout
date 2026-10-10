import CreditCardIcon from '@mui/icons-material/CreditCard';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import type { Product } from '@/shared/api/types';
import { Money } from '@/shared/components/Money';
import { ResponsiveImage } from '@/shared/components/ResponsiveImage';
import { StockChip } from './StockChip';

interface ProductCardProps {
  product: Product;
  imagePriority?: 'high' | 'eager' | 'lazy';
  onPay: (productId: string) => void;
}

const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: lines,
  overflow: 'hidden',
});

export function ProductCard({ product, imagePriority = 'lazy', onPay }: ProductCardProps) {
  const titleId = useId();
  const soldOut = product.stock <= 0;

  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      <ResponsiveImage
        src={product.imageUrl}
        alt={product.name}
        priority={imagePriority}
        sx={soldOut ? { filter: 'grayscale(1)', opacity: 0.7 } : undefined}
      />

      <Stack spacing={1.5} sx={{ flex: 1, p: 2, minWidth: 0 }}>
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={titleId} variant="h3" sx={clampLines(2)}>
            {product.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={clampLines(3)}>
            {product.description}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            columnGap: 1,
            rowGap: 0.5,
          }}
        >
          <Typography component="p" sx={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1.2 }}>
            <Money amountInCents={product.priceInCents} currency={product.currency} />
          </Typography>
          <StockChip stock={product.stock} />
        </Stack>

        <Button
          variant="contained"
          fullWidth
          startIcon={<CreditCardIcon />}
          disabled={soldOut}
          aria-describedby={titleId}
          onClick={() => onPay(product.id)}
        >
          Pay with credit card
        </Button>
      </Stack>
    </Card>
  );
}
