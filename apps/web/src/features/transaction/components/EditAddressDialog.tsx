import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { deliveryAddressSchema, type DeliveryAddressFormValues } from '@/features/checkout';
import { useUpdateDeliveryAddressMutation } from '@/shared/api/baseApi';
import type { Delivery, DeliveryAddressPatch } from '@/shared/api/types';

const FIELDS = [
  { name: 'addressLine1', label: 'Address', autoComplete: 'address-line1', full: true },
  {
    name: 'addressLine2',
    label: 'Apartment, suite (optional)',
    autoComplete: 'address-line2',
    full: true,
  },
  { name: 'city', label: 'City', autoComplete: 'address-level2', full: false },
  { name: 'region', label: 'Region', autoComplete: 'address-level1', full: false },
  { name: 'postalCode', label: 'Postal code (optional)', autoComplete: 'postal-code', full: true },
] as const;

/** Optional lines are sent only when filled: the API keeps what is not sent. */
export function toAddressPatch(values: DeliveryAddressFormValues): DeliveryAddressPatch {
  return {
    addressLine1: values.addressLine1,
    city: values.city,
    region: values.region,
    ...(values.addressLine2 ? { addressLine2: values.addressLine2 } : {}),
    ...(values.postalCode ? { postalCode: values.postalCode } : {}),
  };
}

interface EditAddressDialogProps {
  delivery: Delivery;
  onClose: () => void;
}

/** Corrects the delivery address while the order has not been shipped. */
export function EditAddressDialog({ delivery, onClose }: EditAddressDialogProps) {
  const [updateAddress, update] = useUpdateDeliveryAddressMutation();
  const { address } = delivery;
  const form = useForm<DeliveryAddressFormValues>({
    resolver: zodResolver(deliveryAddressSchema),
    defaultValues: {
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      region: address.region,
      postalCode: address.postalCode ?? '',
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await updateAddress({
      deliveryId: delivery.id,
      transactionId: delivery.transactionId,
      address: toAddressPatch(deliveryAddressSchema.parse(values)),
    });
    if (!('error' in result)) onClose();
  });

  return (
    <Dialog open onClose={update.isLoading ? undefined : onClose} fullWidth maxWidth="xs">
      <Box component="form" noValidate onSubmit={(event) => void submit(event)}>
        <DialogTitle>Edit delivery address</DialogTitle>
        <DialogContent
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: 2,
            rowGap: 2,
            pt: '8px !important',
          }}
        >
          {FIELDS.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              autoComplete={field.autoComplete}
              error={Boolean(errors[field.name])}
              helperText={errors[field.name]?.message}
              sx={{ gridColumn: field.full ? '1 / -1' : undefined }}
              {...form.register(field.name)}
            />
          ))}
          {update.error && (
            <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
              {update.error.code === 'DELIVERY_NOT_EDITABLE'
                ? 'This order is already on its way, so its address can no longer be changed.'
                : update.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={update.isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={update.isLoading}>
            Save address
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
