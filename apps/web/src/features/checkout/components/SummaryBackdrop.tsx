import Alert from '@mui/material/Alert';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Modal from '@mui/material/Modal';
import Paper from '@mui/material/Paper';
import Slide from '@mui/material/Slide';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, type MouseEvent } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetPaymentConfigQuery } from '@/shared/api/baseApi';
import type { Product } from '@/shared/api/types';
import { Money } from '@/shared/ui/atoms/Money';
import { paymentInfoEditRequested } from '../checkoutSlice';
import { confirmPayment } from '../confirmPayment';
import {
  selectDelivery,
  selectIsPaying,
  selectOrderAmounts,
  selectQuantity,
  selectSubmission,
  selectTokenizedCard,
} from '../selectors';
import { CardBrandLogo } from './CardBrandLogo';
import { SummaryRow } from './SummaryRow';

const BRAND_NAMES = { VISA: 'VISA', MASTERCARD: 'MasterCard' } as const;
const SHEET_RADIUS = 20;

interface SummaryBackdropProps {
  product: Product;
}

/**
 * Step 3: the order summary inside a Material `Backdrop` — a bottom sheet over the dimmed product
 * page on phones, a centred card from `sm` up. `Modal` (without its own backdrop) only contributes
 * the portal, focus trap, scroll lock and `Esc` handling around the `Backdrop`.
 */
export function SummaryBackdrop({ product }: SummaryBackdropProps) {
  const dispatch = useAppDispatch();
  const titleId = useId();
  const quantity = useAppSelector(selectQuantity);
  const amounts = useAppSelector(selectOrderAmounts);
  const card = useAppSelector(selectTokenizedCard);
  const delivery = useAppSelector(selectDelivery);
  const submission = useAppSelector(selectSubmission);
  const isPaying = useAppSelector(selectIsPaying);
  const config = useGetPaymentConfigQuery();

  const handleEdit = () => {
    if (!isPaying) dispatch(paymentInfoEditRequested());
  };
  const handleBackdropClick = (event: MouseEvent<HTMLElement>) => {
    // Only a click on the dimmed area itself dismisses, not one that bubbles from the sheet.
    if (event.target === event.currentTarget) handleEdit();
  };

  const feesUnavailable = config.isError && !config.data;
  const address = delivery
    ? [delivery.addressLine1, delivery.addressLine2, delivery.city, delivery.region]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Modal open hideBackdrop onClose={handleEdit}>
      <Backdrop
        open
        onClick={handleBackdropClick}
        data-testid="summary-backdrop"
        sx={{ alignItems: { xs: 'flex-end', sm: 'center' }, p: { xs: 0, sm: 2 }, outline: 'none' }}
      >
        <Slide in appear direction="up">
          <Paper
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            elevation={12}
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: 440 },
              maxHeight: { xs: '92dvh', sm: 'calc(100dvh - 32px)' },
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              borderRadius: {
                xs: `${SHEET_RADIUS}px ${SHEET_RADIUS}px 0 0`,
                sm: `${SHEET_RADIUS}px`,
              },
              px: { xs: 2, sm: 3 },
              pt: 1.5,
              pb: (theme) => `calc(${theme.spacing(2)} + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <Box
              aria-hidden
              sx={{
                display: { xs: 'block', sm: 'none' },
                width: 40,
                height: 4,
                mx: 'auto',
                mb: 1.5,
                borderRadius: 2,
                bgcolor: 'divider',
              }}
            />

            <Stack spacing={2}>
              <Typography id={titleId} variant="h2">
                Order summary
              </Typography>

              <Stack component="dl" spacing={1} sx={{ m: 0 }}>
                <SummaryRow
                  label={`${product.name} × ${quantity}`}
                  index={0}
                  amountInCents={amounts?.subtotalInCents ?? product.priceInCents * quantity}
                  currency={product.currency}
                />
                <SummaryRow
                  label="Base fee"
                  index={1}
                  amountInCents={amounts?.baseFeeInCents ?? null}
                  currency={product.currency}
                />
                <SummaryRow
                  label="Delivery fee"
                  index={2}
                  amountInCents={amounts?.deliveryFeeInCents ?? null}
                  currency={product.currency}
                />
                <Divider component="div" role="presentation" sx={{ my: 0.5 }} />
                <SummaryRow
                  label="Total"
                  index={3}
                  amountInCents={amounts?.totalInCents ?? null}
                  currency={product.currency}
                  emphasis
                />
              </Stack>

              <Stack
                spacing={1.5}
                sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', minWidth: 0 }}
              >
                {card && (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <CardBrandLogo brand={card.brand} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" component="p">
                        Paying with
                      </Typography>
                      <Typography sx={{ fontWeight: 600 }}>
                        {BRAND_NAMES[card.brand]} •••• {card.lastFour}
                      </Typography>
                    </Box>
                  </Stack>
                )}
                {delivery && (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" component="p">
                      Deliver to
                    </Typography>
                    <Typography sx={{ fontWeight: 600 }}>{delivery.fullName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {address}
                    </Typography>
                  </Box>
                )}
              </Stack>

              {feesUnavailable && (
                <Alert
                  severity="error"
                  action={
                    <Button color="inherit" size="small" onClick={() => void config.refetch()}>
                      Retry
                    </Button>
                  }
                >
                  We could not load the fees.
                </Alert>
              )}
              {submission.status === 'failed' && submission.error && (
                <Alert severity="error">{submission.error.message}</Alert>
              )}

              <Stack spacing={1}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={!amounts || isPaying}
                  loading={isPaying}
                  loadingPosition="start"
                  onClick={() => void dispatch(confirmPayment())}
                >
                  {isPaying ? 'Processing payment…' : 'Pay'}
                  {!isPaying && amounts && (
                    <>
                      &nbsp;
                      <Money amountInCents={amounts.totalInCents} currency={product.currency} />
                    </>
                  )}
                </Button>
                <Button fullWidth disabled={isPaying} onClick={handleEdit}>
                  Edit details
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Slide>
      </Backdrop>
    </Modal>
  );
}
