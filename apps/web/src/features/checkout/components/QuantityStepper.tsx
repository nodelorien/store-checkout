import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';

interface QuantityStepperProps {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

export function QuantityStepper({ value, max, disabled = false, onChange }: QuantityStepperProps) {
  return (
    <Stack
      direction="row"
      role="group"
      aria-label="Quantity"
      sx={{
        alignItems: 'center',
        flexShrink: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 999,
      }}
    >
      <IconButton
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Box
        component="output"
        aria-live="polite"
        aria-label={`Quantity: ${value}`}
        sx={{
          minWidth: 28,
          textAlign: 'center',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Box>
      <IconButton
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
