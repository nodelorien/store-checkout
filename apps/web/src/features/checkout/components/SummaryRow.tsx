import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { Money } from '@/shared/components/Money';

interface SummaryRowProps {
  label: string;
  /** `null` while the amount is not known yet (renders a placeholder). */
  amountInCents: number | null;
  currency?: string;
  emphasis?: boolean;
}

/** One "label … amount" line of the order summary (a `dt`/`dd` pair). */
export function SummaryRow({ label, amountInCents, currency, emphasis = false }: SummaryRowProps) {
  const variant = emphasis ? 'h3' : 'body1';

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
      <Typography
        component="dt"
        variant={variant}
        color={emphasis ? 'text.primary' : 'text.secondary'}
        sx={{ minWidth: 0 }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        variant={variant}
        sx={{ m: 0, flexShrink: 0, fontWeight: emphasis ? 700 : 500 }}
      >
        {amountInCents === null ? (
          <Skeleton width={88} aria-label="Loading amount" />
        ) : (
          <Money amountInCents={amountInCents} currency={currency} />
        )}
      </Typography>
    </Box>
  );
}
