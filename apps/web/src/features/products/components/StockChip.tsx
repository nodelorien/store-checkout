import Chip from '@mui/material/Chip';

const LOW_STOCK_THRESHOLD = 3;

export function stockLabel(stock: number): string {
  if (stock <= 0) return 'Sold out';
  if (stock <= LOW_STOCK_THRESHOLD) return `Only ${stock} left`;
  return `${stock} in stock`;
}

/** Stock is always stated in words; colour only reinforces it. */
export function StockChip({ stock }: { stock: number }) {
  const color = stock <= 0 ? 'default' : stock <= LOW_STOCK_THRESHOLD ? 'warning' : 'success';

  return (
    <Chip
      size="small"
      variant={stock <= 0 ? 'filled' : 'outlined'}
      color={color}
      label={stockLabel(stock)}
      sx={{ flexShrink: 0 }}
    />
  );
}
