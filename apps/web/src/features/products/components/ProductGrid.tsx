import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type { PropsWithChildren } from 'react';
import type { Product } from '@/shared/api/types';
import { Reveal } from '@/shared/motion';
import { ProductCard } from './ProductCard';

/** Number of cards visible without scrolling on common viewports; these images load eagerly. */
const ABOVE_THE_FOLD = 2;
/** Cards that enter together are staggered within a row of at most this many. */
const STAGGER_GROUP = 3;

export function GridList({ children, busy = false }: PropsWithChildren<{ busy?: boolean }>) {
  return (
    <Box
      component="ul"
      aria-busy={busy}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        // `min(260px, 100%)` keeps a single column from overflowing very narrow viewports.
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
        gap: { xs: 2, md: 3 },
      }}
    >
      {children}
    </Box>
  );
}

function imagePriority(index: number) {
  if (index === 0) return 'high';
  return index < ABOVE_THE_FOLD ? 'eager' : 'lazy';
}

interface ProductItemsProps {
  products: Product[];
  /** Position of the first product in the whole list (0 for the first page). */
  startIndex?: number;
  onPay: (productId: string) => void;
}

/** The cards of one page, as list items of a `GridList`. */
export function ProductItems({ products, startIndex = 0, onPay }: ProductItemsProps) {
  return products.map((product, index) => (
    <Reveal component="li" key={product.id} index={index % STAGGER_GROUP} sx={{ minWidth: 0 }}>
      <ProductCard
        product={product}
        imagePriority={imagePriority(startIndex + index)}
        onPay={onPay}
      />
    </Reveal>
  ));
}

/** Placeholders for a page that is loading, as list items of a `GridList`. */
export function SkeletonItems({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <Box component="li" key={index} aria-hidden sx={{ minWidth: 0 }}>
      <Card>
        <Skeleton variant="rectangular" sx={{ aspectRatio: '4 / 3', height: 'auto' }} />
        <Stack spacing={1} sx={{ p: 2 }}>
          <Skeleton variant="text" width="70%" sx={{ fontSize: '1.125rem' }} />
          <Skeleton variant="text" />
          <Skeleton variant="text" width="40%" sx={{ fontSize: '1.375rem' }} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      </Card>
    </Box>
  ));
}
