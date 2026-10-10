import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { alpha, keyframes } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import type { Transaction } from '@/shared/api/types';
import { motion, revealSx, useReducedMotion, useReveal } from '@/shared/motion';
import { visuallyHidden } from '@/shared/ui/atoms/visuallyHidden';
import { Money } from '@/shared/ui/atoms/Money';
import {
  canRetryPayment,
  nextStepsFor,
  statusContentFor,
  statusMotionFor,
  type StatusContent,
} from './statusContent';

export interface DeliveryRecap {
  fullName: string;
  address: string;
}

interface TransactionStatusProps {
  transaction: Transaction;
  pollingTimedOut: boolean;
  /** Address of the order, when known (only the customer's own device has it). */
  delivery: DeliveryRecap | null;
  /** Order tracking, shown instead of the plain address once the delivery is known. */
  tracking?: ReactNode;
  checking: boolean;
  onBackToStore: () => void;
  onTryAgain: () => void;
  onCheckAgain: () => void;
}

const CARD_BRAND_NAMES = { VISA: 'VISA', MASTERCARD: 'MasterCard' } as const;

// Slightly longer than the normalised path (1) so rounding never leaves a gap in the stroke.
const DASH = 1.05;
const draw = keyframes({ from: { strokeDashoffset: DASH }, to: { strokeDashoffset: 0 } });
const { nudge: NUDGE } = motion.distance;
const nudge = keyframes({
  '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
  '25%': { transform: `translate3d(${-NUDGE}px, 0, 0)` },
  '60%': { transform: `translate3d(${NUDGE}px, 0, 0)` },
  '85%': { transform: `translate3d(${-NUDGE / 2}px, 0, 0)` },
});

/** Approved mark. Its resting state is fully drawn, so it is complete without the animation. */
function DrawnCheck() {
  const stroke = (delay: number) => ({
    strokeDasharray: DASH,
    animation: `${draw} ${motion.duration.emphasis}ms ${motion.easing.standard} ${delay}ms backwards`,
  });

  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      focusable="false"
      sx={{ width: 40, height: 40, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}
    >
      <Box component="circle" cx="12" cy="12" r="9" pathLength={1} sx={stroke(0)} />
      <Box
        component="path"
        d="M8 12.5l2.8 2.8L16.2 9.5"
        pathLength={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={stroke(motion.duration.feedback)}
      />
    </Box>
  );
}

function StatusIcon({ content, pending }: { content: StatusContent; pending: boolean }) {
  if (pending && content.tone === 'info') {
    return <CircularProgress size={40} aria-label="Processing" />;
  }
  if (content.tone === 'success') return <DrawnCheck />;
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
        sx={{ fontWeight: strong ? 700 : 400, flexShrink: 0 }}
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
  tracking,
  checking,
  onBackToStore,
  onTryAgain,
  onCheckAgain,
}: TransactionStatusProps) {
  const content = statusContentFor(transaction, pollingTimedOut);
  const pending = transaction.status === 'PENDING';
  const { amounts, currency } = transaction;
  const iconMotion = statusMotionFor(content.tone, useReducedMotion());
  const reveal = useReveal<HTMLDivElement>();
  const nextSteps = nextStepsFor(transaction.status);
  const [copied, setCopied] = useState(false);

  const copyReference = () => {
    void navigator.clipboard
      ?.writeText(transaction.reference)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <Paper
      ref={reveal.ref}
      variant="outlined"
      data-reveal={reveal.state}
      sx={{
        maxWidth: 560,
        mx: 'auto',
        p: { xs: 2.5, sm: 4 },
        borderRadius: 2,
        minWidth: 0,
        ...revealSx(reveal.state),
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Box
            // Keyed by tone: the animation plays once, when the final result replaces the spinner.
            key={content.tone}
            aria-hidden={!pending}
            data-motion={iconMotion}
            sx={(theme) => ({
              display: 'grid',
              placeItems: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              color: `${content.tone}.main`,
              bgcolor: alpha(theme.palette[content.tone].main, 0.12),
              boxShadow: `0 0 0 10px ${alpha(theme.palette[content.tone].main, 0.05)}, 0 0 44px ${alpha(theme.palette[content.tone].main, 0.3)}`,
              ...(iconMotion === 'nudge' && {
                animation: `${nudge} ${motion.duration.emphasis}ms ${motion.easing.standard} 1`,
              }),
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
            <Box
              component="span"
              sx={{ fontFamily: 'monospace', fontSize: '0.875rem', overflowWrap: 'anywhere' }}
            >
              {transaction.reference}
            </Box>
            <IconButton
              size="small"
              aria-label="Copy reference"
              onClick={copyReference}
              data-print-hide
              sx={{ ml: 0.5, my: -1 }}
            >
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
            {copied && (
              <Box component="span" role="status" sx={visuallyHidden}>
                Reference copied
              </Box>
            )}
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

        {nextSteps.length > 0 && (
          <Box>
            <Typography variant="subtitle2" component="h3" color="text.secondary">
              What you can do
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, color: 'text.secondary' }}>
              {nextSteps.map((step) => (
                <Typography component="li" variant="body2" key={step} sx={{ mb: 0.5 }}>
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {tracking}

        {transaction.status === 'APPROVED' && delivery && !tracking && (
          <Box>
            <Typography variant="subtitle2" component="h3" color="text.secondary">
              Delivering to
            </Typography>
            <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{delivery.fullName}</Typography>
            <Typography color="text.secondary">{delivery.address}</Typography>
          </Box>
        )}

        <Stack direction={{ xs: 'column', sm: 'row-reverse' }} spacing={1.5} data-print-hide>
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

        {transaction.status === 'APPROVED' && (
          <Button
            size="small"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
            data-print-hide
            sx={{ alignSelf: 'center' }}
          >
            Print receipt
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
