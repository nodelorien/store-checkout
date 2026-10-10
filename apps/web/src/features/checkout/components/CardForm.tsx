import Box from '@mui/material/Box';
import { useWatch } from 'react-hook-form';
import {
  UNSUPPORTED_BRAND_MESSAGE,
  detectCardBrand,
  isUnsupportedBrand,
} from '../validation/cardBrand';
import { formatCardNumber, formatCvc, formatExpiry } from '../validation/cardFormat';
import type { PaymentInfoFormValues } from '../validation/schemas';
import { CardBrandLogo } from './CardBrandLogo';
import { FormTextField } from './FormTextField';

/**
 * Card inputs. Their values live only in the form state of React Hook Form: they are never
 * dispatched, persisted or logged. The only consumer is the tokenization call on submit.
 */
export function CardForm() {
  const cardNumber = useWatch<PaymentInfoFormValues, 'card.number'>({ name: 'card.number' });
  const brand = detectCardBrand(cardNumber);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 2,
        rowGap: 0.5,
      }}
    >
      <FormTextField
        name="card.number"
        label="Card number"
        autoComplete="cc-number"
        inputMode="numeric"
        placeholder="1234 5678 9012 3456"
        maxLength={23}
        format={formatCardNumber}
        warning={isUnsupportedBrand(cardNumber) ? UNSUPPORTED_BRAND_MESSAGE : null}
        endAdornment={<CardBrandLogo brand={brand} />}
        sx={{ gridColumn: '1 / -1' }}
      />
      <FormTextField
        name="card.holder"
        label="Name on card"
        autoComplete="cc-name"
        maxLength={100}
        sx={{ gridColumn: '1 / -1' }}
      />
      <FormTextField
        name="card.expiry"
        label="Expiry date"
        autoComplete="cc-exp"
        inputMode="numeric"
        placeholder="MM/YY"
        maxLength={5}
        format={formatExpiry}
        hint="MM/YY"
      />
      <FormTextField
        name="card.cvc"
        label="CVC"
        type="password"
        autoComplete="cc-csc"
        inputMode="numeric"
        maxLength={3}
        format={formatCvc}
        hint="3 numbers on the back"
      />
    </Box>
  );
}
