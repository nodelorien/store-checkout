import { zodResolver } from '@hookform/resolvers/zod';
import CloseIcon from '@mui/icons-material/Close';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useId, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetPaymentConfigQuery } from '@/shared/api/baseApi';
import type { Product } from '@/shared/api/types';
import {
  checkoutDialogClosed,
  deliveryDraftChanged,
  noticeDismissed,
  termsAcceptanceChanged,
  type DeliveryInfo,
} from '../checkoutSlice';
import {
  selectAcceptedTerms,
  selectDelivery,
  selectDialogNotice,
  selectIsTokenizing,
  selectSubmission,
} from '../selectors';
import { submitPaymentInfo } from '../thunks';
import { onlyNumeric, parseExpiry } from '../validation/cardFormat';
import {
  createPaymentInfoSchema,
  type PaymentInfoFormOutput,
  type PaymentInfoFormValues,
} from '../validation/schemas';
import { CardForm } from './CardForm';
import { DeliveryForm } from './DeliveryForm';
import { FormSection } from './FormSection';
import { OrderLine } from './OrderLine';
import { TermsField } from './TermsField';

const EMPTY_CARD = { number: '', holder: '', expiry: '', cvc: '' };
const EMPTY_DELIVERY: DeliveryInfo = {
  fullName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
};

function toDeliveryDraft(values: Partial<DeliveryInfo> | undefined): DeliveryInfo {
  return {
    fullName: values?.fullName ?? '',
    email: values?.email ?? '',
    phone: values?.phone ?? '',
    addressLine1: values?.addressLine1 ?? '',
    addressLine2: values?.addressLine2 ?? '',
    city: values?.city ?? '',
    region: values?.region ?? '',
    postalCode: values?.postalCode ?? '',
  };
}

interface CheckoutDialogProps {
  product: Product;
  open: boolean;
}

/**
 * Step 2: card and delivery details in a modal (full-screen on phones).
 *
 * It stays mounted (hidden) while the summary is showing, so going back to edit does not force
 * the customer to retype the card: the card values survive in this component's form state only,
 * never in Redux or storage, and are gone after a refresh or once the flow leaves steps 2–3.
 */
export function CheckoutDialog({ product, open }: CheckoutDialogProps) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();

  const savedDelivery = useAppSelector(selectDelivery);
  const savedAcceptedTerms = useAppSelector(selectAcceptedTerms);
  const notice = useAppSelector(selectDialogNotice);
  const submission = useAppSelector(selectSubmission);
  const isTokenizing = useAppSelector(selectIsTokenizing);
  const config = useGetPaymentConfigQuery();

  const [schema] = useState(() => createPaymentInfoSchema());
  const form = useForm<PaymentInfoFormValues, unknown, PaymentInfoFormOutput>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      card: EMPTY_CARD,
      delivery: savedDelivery ?? EMPTY_DELIVERY,
      acceptedTerms: savedAcceptedTerms,
    },
  });
  const { isSubmitted, isValid } = form.formState;

  // Mirror delivery data and the terms tick (never card fields) into Redux so a refresh keeps them.
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name?.startsWith('delivery.')) {
        dispatch(deliveryDraftChanged(toDeliveryDraft(values.delivery)));
      } else if (name === 'acceptedTerms') {
        dispatch(termsAcceptanceChanged(values.acceptedTerms === true));
      }
    });
    return () => subscription.unsubscribe();
  }, [form, dispatch]);

  const handleClose = () => {
    if (!isTokenizing) dispatch(checkoutDialogClosed());
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const expiry = parseExpiry(values.card.expiry);
    if (!expiry) return;

    await dispatch(
      submitPaymentInfo(
        {
          number: onlyNumeric(values.card.number),
          cvc: values.card.cvc,
          expMonth: expiry.month,
          expYear: expiry.year,
          holder: values.card.holder,
        },
        values.delivery,
      ),
    );
  });

  const configUnavailable = config.isError && !config.data;
  const canSubmit = Boolean(config.data) && !isTokenizing;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      keepMounted
      aria-labelledby={titleId}
    >
      <FormProvider {...form}>
        <Box
          component="form"
          noValidate
          autoComplete="on"
          onSubmit={(event) => void handleSubmit(event)}
          sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
        >
          <DialogTitle
            id={titleId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              py: 1.5,
              pl: { xs: 2, sm: 3 },
              pr: 1,
            }}
          >
            Checkout
            <IconButton aria-label="Close checkout" onClick={handleClose} disabled={isTokenizing}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
            <Stack spacing={3}>
              <OrderLine product={product} disabled={isTokenizing} />

              {notice && (
                <Alert severity="warning" onClose={() => dispatch(noticeDismissed())}>
                  {notice}
                </Alert>
              )}

              <FormSection title="Card details" icon={<CreditCardIcon fontSize="small" />}>
                <CardForm />
              </FormSection>

              <FormSection
                title="Delivery details"
                icon={<LocalShippingOutlinedIcon fontSize="small" />}
              >
                <DeliveryForm />
              </FormSection>

              <TermsField permalink={config.data?.acceptance.permalink} />

              {configUnavailable && (
                <Alert
                  severity="error"
                  action={
                    <Button color="inherit" size="small" onClick={() => void config.refetch()}>
                      Retry
                    </Button>
                  }
                >
                  We could not load the payment settings.
                </Alert>
              )}
              {isSubmitted && !isValid && (
                <Alert severity="error">Please review the highlighted fields.</Alert>
              )}
              {submission.status === 'failed' && submission.error && (
                <Alert severity="error">{submission.error.message}</Alert>
              )}
            </Stack>
          </DialogContent>

          <DialogActions
            sx={{
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 1,
              px: { xs: 2, sm: 3 },
              pt: 2,
              pb: (t) => `calc(${t.spacing(2)} + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={!canSubmit}
              loading={isTokenizing}
            >
              Continue to summary
            </Button>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}
            >
              <LockOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
              <Typography variant="caption">
                Sent encrypted to the payment gateway. We never store your card.
              </Typography>
            </Stack>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  );
}
