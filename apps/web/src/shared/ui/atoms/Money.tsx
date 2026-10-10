import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { formatMoney } from '@/shared/lib/formatMoney';

interface MoneyProps {
  amountInCents: number;
  currency?: string;
  sx?: SxProps<Theme>;
}

/** Renders integer cents as formatted money. Kept on one line so amounts never wrap mid-number. */
export function Money({ amountInCents, currency = 'COP', sx }: MoneyProps) {
  return (
    <Box
      component="span"
      sx={[
        { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {formatMoney(amountInCents, currency)}
    </Box>
  );
}
