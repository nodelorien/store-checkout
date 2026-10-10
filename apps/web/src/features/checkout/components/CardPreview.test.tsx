import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { theme } from '@/app/theme';
import type { PaymentInfoFormValues } from '../validation/schemas';
import { CardPreview } from './CardPreview';

type CardValues = Partial<PaymentInfoFormValues['card']>;

function Harness({ card }: { card: CardValues }) {
  const form = useForm<PaymentInfoFormValues>({
    defaultValues: { card: { number: '', holder: '', expiry: '', cvc: '', ...card } },
  });
  return (
    <ThemeProvider theme={theme}>
      <FormProvider {...form}>
        <CardPreview />
      </FormProvider>
    </ThemeProvider>
  );
}

describe('CardPreview', () => {
  it('AC-3: shows an empty card before anything is typed', () => {
    render(<Harness card={{}} />);

    expect(screen.getByTestId('card-preview-number')).toHaveTextContent('•••• •••• •••• ••••');
    expect(screen.getByTestId('card-preview-holder')).toHaveTextContent('Your name');
    expect(screen.getByTestId('card-preview-expiry')).toHaveTextContent('MM/YY');
  });

  it('AC-3: mirrors the number, holder and expiry being typed', () => {
    render(<Harness card={{ number: '5555 5555', holder: ' Ada Lovelace ', expiry: '08/30' }} />);

    expect(screen.getByTestId('card-preview-number')).toHaveTextContent('5555 5555 •••• ••••');
    expect(screen.getByTestId('card-preview-holder')).toHaveTextContent('Ada Lovelace');
    expect(screen.getByTestId('card-preview-expiry')).toHaveTextContent('08/30');
  });

  it('AC-4: never shows the security code', () => {
    render(<Harness card={{ number: '4242424242424242', cvc: '987' }} />);

    expect(screen.getByTestId('card-preview')).not.toHaveTextContent('987');
  });

  it('AC-4: is hidden from assistive technology, which already has the labelled fields', () => {
    render(<Harness card={{ number: '4242424242424242' }} />);

    expect(screen.getByTestId('card-preview')).toHaveAttribute('aria-hidden', 'true');
  });
});
