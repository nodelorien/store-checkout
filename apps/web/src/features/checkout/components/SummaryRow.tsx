import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { revealSx, useReveal } from '@/shared/motion';
import { Money } from '@/shared/ui/atoms/Money';

interface SummaryRowProps {
  label: string;
  /** `null` while the amount is not known yet (renders a placeholder). */
  amountInCents: number | null;
  currency?: string;
  emphasis?: boolean;
  /** Position in the summary; rows enter one after another. */
  index?: number;
}

/** One "label … amount" line of the order summary (a `dt`/`dd` pair). */
export function SummaryRow({
  label,
  amountInCents,
  currency,
  emphasis = false,
  index = 0,
}: SummaryRowProps) {
  const variant = emphasis ? 'h3' : 'body1';
  const { ref, state } = useReveal<HTMLDivElement>();

  return (
    <Box
      ref={ref}
      data-reveal={state}
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 2,
        ...revealSx(state, index),
      }}
    >
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
