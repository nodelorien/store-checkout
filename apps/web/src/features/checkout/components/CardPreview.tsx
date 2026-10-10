import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useWatch } from 'react-hook-form';
import { detectCardBrand } from '../validation/cardBrand';
import { previewCardNumber } from '../validation/cardFormat';
import type { PaymentInfoFormValues } from '../validation/schemas';
import { CardBrandLogo } from './CardBrandLogo';

const label = {
  display: 'block',
  fontSize: '0.625rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.72,
} as const;

/**
 * A picture of the card being typed. It mirrors the number, holder and expiry fields of the form
 * it is rendered in — never the CVC — and is hidden from assistive technology, which already has
 * the labelled inputs. Like the inputs, the values exist only in the form state.
 */
export function CardPreview() {
  const number = useWatch<PaymentInfoFormValues, 'card.number'>({ name: 'card.number' }) ?? '';
  const holder = useWatch<PaymentInfoFormValues, 'card.holder'>({ name: 'card.holder' }) ?? '';
  const expiry = useWatch<PaymentInfoFormValues, 'card.expiry'>({ name: 'card.expiry' }) ?? '';

  return (
    <Box
      aria-hidden
      data-testid="card-preview"
      sx={(theme) => ({
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 340,
        aspectRatio: '1.586',
        mx: 'auto',
        mb: 2.5,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: '18px',
        color: 'common.white',
        backgroundImage: theme.brand.card,
        boxShadow: theme.brand.glow,
        // Two faint rings, the same motif as the store's hero.
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          zIndex: -1,
          borderRadius: '50%',
          border: `28px solid ${alpha(theme.palette.common.white, 0.08)}`,
        },
        '&::before': { width: 220, height: 220, top: -110, right: -70 },
        '&::after': { width: 160, height: 160, bottom: -100, left: -50 },
      })}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box
          sx={(theme) => ({
            width: 40,
            height: 30,
            borderRadius: '7px',
            border: `1px solid ${alpha(theme.palette.common.white, 0.45)}`,
            backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.5)}, ${alpha(theme.palette.common.white, 0.12)})`,
          })}
        />
        <CardBrandLogo brand={detectCardBrand(number)} />
      </Stack>

      <Typography
        data-testid="card-preview-number"
        sx={{
          fontSize: 'clamp(1rem, 5.2vw, 1.3125rem)',
          fontWeight: 500,
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
        }}
      >
        {previewCardNumber(number)}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box component="span" sx={label}>
            Card holder
          </Box>
          <Typography
            data-testid="card-preview-holder"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {holder.trim() || 'Your name'}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
          <Box component="span" sx={label}>
            Expires
          </Box>
          <Typography data-testid="card-preview-expiry" sx={{ fontWeight: 500 }}>
            {expiry || 'MM/YY'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
