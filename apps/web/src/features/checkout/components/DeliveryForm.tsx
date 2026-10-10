import Box from '@mui/material/Box';
import { FormTextField } from './FormTextField';

const fullRow = { gridColumn: '1 / -1' };

export function DeliveryForm() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        columnGap: 2,
        rowGap: 0.5,
      }}
    >
      <FormTextField
        name="delivery.fullName"
        label="Full name"
        autoComplete="name"
        maxLength={100}
        sx={fullRow}
      />
      <FormTextField
        name="delivery.email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
      />
      <FormTextField
        name="delivery.phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+573001234567"
        maxLength={24}
      />
      <FormTextField
        name="delivery.addressLine1"
        label="Address"
        autoComplete="address-line1"
        maxLength={120}
        sx={fullRow}
      />
      <FormTextField
        name="delivery.addressLine2"
        label="Apartment, suite"
        autoComplete="address-line2"
        maxLength={120}
        optional
        sx={fullRow}
      />
      <FormTextField
        name="delivery.city"
        label="City"
        autoComplete="address-level2"
        maxLength={60}
      />
      <FormTextField
        name="delivery.region"
        label="Region"
        autoComplete="address-level1"
        maxLength={60}
      />
      <FormTextField
        name="delivery.postalCode"
        label="Postal code"
        autoComplete="postal-code"
        maxLength={10}
        optional
        hint="We deliver within Colombia"
        sx={fullRow}
      />
    </Box>
  );
}
