import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { Delivery } from '@/shared/api/types';
import { trackingStepsFor } from './statusContent';

interface DeliveryTrackerProps {
  delivery: Delivery;
  /** The address is shown, and can be corrected, only on the device that placed the order. */
  showAddress: boolean;
  onEditAddress: () => void;
}

export function formatAddress(address: Delivery['address']): string {
  return [address.addressLine1, address.addressLine2, address.city, address.region]
    .filter(Boolean)
    .join(', ');
}

/** The order's journey after an approved payment, from the delivery kept by the API. */
export function DeliveryTracker({ delivery, showAddress, onEditAddress }: DeliveryTrackerProps) {
  const steps = trackingStepsFor(delivery.status);

  return (
    <Stack component="section" aria-label="Order tracking" spacing={2}>
      <Typography variant="subtitle2" component="h3" color="text.secondary">
        Order tracking
      </Typography>

      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {steps.map((step, index) => {
          const reached = step.state !== 'upcoming';
          return (
            <Box
              component="li"
              key={step.key}
              aria-current={step.state === 'current' ? 'step' : undefined}
              data-state={step.state}
              sx={(theme) => ({
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                pb: index === steps.length - 1 ? 0 : 2,
                color: reached ? 'text.primary' : 'text.secondary',
                // The rail to the next step.
                '&::before': {
                  content: index === steps.length - 1 ? 'none' : '""',
                  position: 'absolute',
                  left: 11,
                  top: 24,
                  bottom: 0,
                  width: 2,
                  bgcolor: step.state === 'done' ? 'primary.dark' : theme.palette.divider,
                },
              })}
            >
              <Box
                aria-hidden
                sx={(theme) => ({
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${reached ? theme.palette.primary.main : theme.palette.divider}`,
                  bgcolor: step.state === 'done' ? 'primary.dark' : 'transparent',
                  boxShadow:
                    step.state === 'current'
                      ? `0 0 0 5px ${alpha(theme.palette.primary.main, 0.18)}`
                      : 'none',
                  color: 'common.white',
                })}
              >
                {step.state === 'done' && <CheckIcon sx={{ fontSize: 16 }} />}
              </Box>
              <Typography sx={{ fontWeight: step.state === 'current' ? 600 : 400 }}>
                {step.label}
                {step.state === 'current' && (
                  <Box component="span" sx={{ color: 'primary.light' }}>
                    {' '}
                    · now
                  </Box>
                )}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {showAddress && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'background.default',
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" component="p">
              Delivering to
            </Typography>
            <Typography>{formatAddress(delivery.address)}</Typography>
          </Box>
          {delivery.status === 'PENDING' && (
            <Button size="small" variant="outlined" onClick={onEditAddress} sx={{ flexShrink: 0 }}>
              Edit address
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
