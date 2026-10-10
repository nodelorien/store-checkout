import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { ratio } from './scale';

interface MeterProps {
  /** 0–1. */
  value: number;
  /** The headline inside the ring, e.g. "72%". */
  text: string;
  caption: string;
}

const SIZE = 168;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;

/** A single headline share drawn as a ring: one hue on a quiet track, the number in the middle. */
export function Meter({ value, text, caption }: MeterProps) {
  const theme = useTheme();
  const share = ratio(value, 1);

  return (
    <Box
      role="img"
      aria-label={`${caption}: ${text}`}
      sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0, mx: 'auto' }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={theme.palette.action.hover}
          strokeWidth={STROKE}
        />
        {share > 0 && (
          <circle
            data-testid="meter-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={theme.brand.chart[0]}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${share * LENGTH} ${LENGTH}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeContent: 'center',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.1 }}>{text}</Typography>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
      </Box>
    </Box>
  );
}
