import CreditCardIcon from '@mui/icons-material/CreditCard';
import Box from '@mui/material/Box';
import type { CardBrand } from '@/shared/api/types';

interface CardBrandLogoProps {
  brand: CardBrand | null;
  /** Rendered height in px; the width follows the 3:2 badge ratio. */
  size?: number;
}

/* Card-scheme marks use the schemes' own colours, which are not part of the store theme. */
const VISA_BLUE = '#1a1f71';
const MASTERCARD_RED = '#eb001b';
const MASTERCARD_YELLOW = '#f79e1b';
const MASTERCARD_ORANGE = '#ff5f00';
const BADGE_BACKGROUND = '#ffffff';
const BADGE_BORDER = '#d5dbe3';

function Badge({
  label,
  size,
  children,
}: {
  label: string;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="svg"
      role="img"
      aria-label={label}
      viewBox="0 0 48 32"
      sx={{ display: 'block', height: size, width: size * 1.5, flexShrink: 0 }}
    >
      <rect
        x="0.5"
        y="0.5"
        width="47"
        height="31"
        rx="4"
        fill={BADGE_BACKGROUND}
        stroke={BADGE_BORDER}
      />
      {children}
    </Box>
  );
}

/** Inline SVG brand marks: no network request, crisp at any density. */
export function CardBrandLogo({ brand, size = 28 }: CardBrandLogoProps) {
  if (brand === 'VISA') {
    return (
      <Badge label="VISA" size={size}>
        <text
          x="24"
          y="21.5"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="14"
          fontWeight="700"
          fontStyle="italic"
          letterSpacing="0.5"
          fill={VISA_BLUE}
          aria-hidden
        >
          VISA
        </text>
      </Badge>
    );
  }

  if (brand === 'MASTERCARD') {
    return (
      <Badge label="MasterCard" size={size}>
        <circle cx="19" cy="16" r="9" fill={MASTERCARD_RED} />
        <circle cx="29" cy="16" r="9" fill={MASTERCARD_YELLOW} />
        <path d="M24 8.5a9 9 0 0 1 0 15a9 9 0 0 1 0-15z" fill={MASTERCARD_ORANGE} />
      </Badge>
    );
  }

  return (
    <CreditCardIcon
      titleAccess="Card"
      sx={{ color: 'text.secondary', fontSize: size, flexShrink: 0 }}
    />
  );
}
