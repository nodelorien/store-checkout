import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import { useController } from 'react-hook-form';
import type { PaymentInfoFormValues } from '../validation/schemas';

interface TermsFieldProps {
  /** Acceptance document of the payment gateway (`acceptance.permalink`). */
  permalink: string | undefined;
}

/** Explicit acceptance of the payment gateway's terms, required before tokenizing. */
export function TermsField({ permalink }: TermsFieldProps) {
  const { field, fieldState } = useController<PaymentInfoFormValues, 'acceptedTerms'>({
    name: 'acceptedTerms',
  });
  const errorId = 'checkout-terms-error';

  return (
    <FormControl error={Boolean(fieldState.error)} component="fieldset" sx={{ minWidth: 0 }}>
      <FormControlLabel
        sx={{ alignItems: 'flex-start', mr: 0 }}
        slotProps={{ typography: { variant: 'body2', sx: { pt: 1.25 } } }}
        control={
          <Checkbox
            name={field.name}
            checked={field.value}
            onChange={(event) => field.onChange(event.target.checked)}
            onBlur={field.onBlur}
            slotProps={{
              input: {
                ref: field.ref,
                'aria-describedby': fieldState.error ? errorId : undefined,
                'aria-invalid': Boolean(fieldState.error),
              },
            }}
          />
        }
        label={
          <>
            I accept the{' '}
            {permalink ? (
              <Link href={permalink} target="_blank" rel="noopener noreferrer">
                terms and conditions
              </Link>
            ) : (
              'terms and conditions'
            )}{' '}
            and authorise the processing of my personal data for this payment.
          </>
        }
      />
      {fieldState.error && <FormHelperText id={errorId}>{fieldState.error.message}</FormHelperText>}
    </FormControl>
  );
}
