import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { Transaction } from '@/shared/api/types';
import { Money } from '@/shared/components/Money';
import { canRetryPayment, statusContentFor, type StatusContent } from './statusContent';

export interface DeliveryRecap {
  fullName: string;
  address: string;
}

interface TransactionStatusProps {
  transaction: Transaction;
  pollingTimedOut: boolean;
  /** Address of the order, when known (only the customer's own device has it). */
  delivery: DeliveryRecap | null;
  checking: boolean;
  onBackToStore: () => void;
  onTryAgain: () => void;
  onCheckAgain: () => void;
}

const CARD_BRAND_NAMES = { VISA: 'VISA', MASTERCARD: 'MasterCard' } as const;

function StatusIcon({ content, pending }: { content: StatusContent; pending: boolean }) {
  if (pending && content.tone === 'info') {
    return <CircularProgress size={40} aria-label="Processing" />;
  }
  if (content.tone === 'success') return <CheckCircleOutlineIcon sx={{ fontSize: 40 }} />;
  if (content.tone === 'warning') return <ScheduleIcon sx={{ fontSize: 40 }} />;
  return <ErrorOutlineIcon sx={{ fontSize: 40 }} />;
}

function Row({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
      <Typography
        component="dt"
        color={strong ? 'text.primary' : 'text.secondary'}
        sx={{ fontWeight: strong ? 700 : 400 }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, textAlign: 'right', fontWeight: strong ? 700 : 500, minWidth: 0 }}
      >
        {children}
      </Typography>
    </Box>
  );
}

/** Step 4: the result of the payment, from the transaction returned by the API. */
export function TransactionStatus({
  transaction,
  pollingTimedOut,
  delivery,
  checking,
  onBackToStore,
  onTryAgain,
  onCheckAgain,
}: TransactionStatusProps) {
  const content = statusContentFor(transaction, pollingTimedOut);
  const pending = transaction.status === 'PENDING';
  const { amounts, currency } = transaction;

  return (
    <Paper
      variant="outlined"
      sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2.5, sm: 4 }, borderRadius: 4, minWidth: 0 }}
    >
      <Stack spacing={3}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Box
            aria-hidden={!pending}
            sx={(theme) => ({
              display: 'grid',
              placeItems: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              color: `${content.tone}.main`,
              bgcolor: alpha(theme.palette[content.tone].main, 0.12),
            })}
          >
            <StatusIcon content={content} pending={pending} />
          </Box>
          <Box aria-live="polite" role="status">
            <Typography variant="h2" component="h2">
              {content.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {content.message}
            </Typography>
          </Box>
        </Stack>

        <Stack
          component="dl"
          spacing={1}
          sx={{ m: 0, p: 2, borderRadius: 2, bgcolor: 'background.default' }}
        >
          <Row label="Reference">
            <Box component="span" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
              {transaction.reference}
            </Box>
          </Row>
          <Row label="Product">
            {transaction.product.name} × {transaction.quantity}
          </Row>
          <Row label="Card">
            {CARD_BRAND_NAMES[transaction.card.brand]} •••• {transaction.card.lastFour}
          </Row>
          <Divider component="div" role="presentation" sx={{ my: 0.5 }} />
          <Row label="Subtotal">
            <Money amountInCents={amounts.subtotalInCents} currency={currency} />
          </Row>
          <Row label="Base fee">
            <Money amountInCents={amounts.baseFeeInCents} currency={currency} />
          </Row>
          <Row label="Delivery fee">
            <Money amountInCents={amounts.deliveryFeeInCents} currency={currency} />
          </Row>
          <Row label={transaction.status === 'APPROVED' ? 'Total paid' : 'Total'} strong>
            <Money amountInCents={amounts.totalInCents} currency={currency} />
          </Row>
        </Stack>

        {transaction.status === 'APPROVED' && delivery && (
          <Box>
            <Typography variant="subtitle2" component="h3" color="text.secondary">
              Delivering to
            </Typography>
            <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{delivery.fullName}</Typography>
            <Typography color="text.secondary">{delivery.address}</Typography>
          </Box>
        )}

        <Stack direction={{ xs: 'column', sm: 'row-reverse' }} spacing={1.5}>
          {canRetryPayment(transaction.status) && (
            <Button variant="contained" size="large" fullWidth onClick={onTryAgain}>
              Try again
            </Button>
          )}
          {pending && pollingTimedOut && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              loading={checking}
              onClick={onCheckAgain}
            >
              Check again
            </Button>
          )}
          <Button
            variant={transaction.status === 'APPROVED' ? 'contained' : 'outlined'}
            size="large"
            fullWidth
            onClick={onBackToStore}
          >
            Back to store
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
