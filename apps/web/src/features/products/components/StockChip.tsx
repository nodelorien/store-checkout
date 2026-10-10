import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha, keyframes } from '@mui/material/styles';
import { motion, useChangeCount } from '@/shared/motion';
import { visuallyHidden } from '@/shared/ui/atoms/visuallyHidden';

const LOW_STOCK_THRESHOLD = 3;

const pulse = keyframes({
  '0%': { opacity: 0, transform: 'scale(0.92)' },
  '30%': { opacity: 1, transform: 'scale(1.06)' },
  '100%': { opacity: 0, transform: 'scale(1)' },
});

export function stockLabel(stock: number): string {
  if (stock <= 0) return 'Sold out';
  if (stock <= LOW_STOCK_THRESHOLD) return `Only ${stock} left`;
  return `${stock} in stock`;
}

/**
 * Stock is always stated in words; colour only reinforces it. When the value changes while the
 * chip is on screen (the list refreshed after a purchase) it is highlighted once and announced.
 */
export function StockChip({ stock }: { stock: number }) {
  const color = stock <= 0 ? 'default' : stock <= LOW_STOCK_THRESHOLD ? 'warning' : 'success';
  const label = stockLabel(stock);
  const changes = useChangeCount(stock);
  const changed = changes > 0;

  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <Chip
        size="small"
        variant={stock <= 0 ? 'filled' : 'outlined'}
        color={color}
        label={label}
        data-stock-changed={changed || undefined}
      />
      {changed && (
        <>
          {/* Re-keyed on every change so the highlight plays once per change. */}
          <Box
            key={changes}
            component="span"
            aria-hidden
            data-testid="stock-highlight"
            sx={(theme) => ({
              position: 'absolute',
              inset: -3,
              borderRadius: 999,
              pointerEvents: 'none',
              opacity: 0,
              bgcolor: alpha(theme.palette.secondary.main, 0.45),
              animation: `${pulse} ${motion.duration.highlight}ms ${motion.easing.standard} 1`,
            })}
          />
          <Box component="span" role="status" sx={visuallyHidden}>
            Stock updated: {label}
          </Box>
        </>
      )}
    </Box>
  );
}
