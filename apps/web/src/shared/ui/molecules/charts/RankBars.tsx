import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { ratio } from './scale';

export interface RankBar {
  /** Value on the shared scale. */
  value: number;
  /** Position in the fixed series order of the theme (0 or 1), or a palette colour for a status. */
  color: 0 | 1 | 'success' | 'error' | 'warning' | 'info';
  /** Printed after the bar. */
  text: string;
}

export interface RankItem {
  key: string;
  label: ReactNode;
  caption?: string;
  bars: RankBar[];
}

/** Horizontal bars on one shared scale, each labelled with its own value (no axis needed). */
export function RankBars({ items }: { items: RankItem[] }) {
  const max = Math.max(0, ...items.flatMap((item) => item.bars.map((bar) => bar.value)));

  return (
    <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.map((item) => (
        <Box component="li" key={item.key} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mb: 0.75 }}>
            <Typography component="div" sx={{ fontWeight: 500, minWidth: 0 }} noWrap>
              {item.label}
            </Typography>
            {item.caption && (
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                {item.caption}
              </Typography>
            )}
          </Stack>
          <Stack spacing={0.5}>
            {item.bars.map((bar, index) => (
              <Stack key={index} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ flex: 1, height: 10, borderRadius: '4px', bgcolor: 'action.hover' }}>
                  <Box
                    data-testid="rank-bar"
                    sx={(theme) => ({
                      height: '100%',
                      // A sliver stays visible for a value that is small but not zero.
                      width: bar.value > 0 ? `max(4px, ${ratio(bar.value, max) * 100}%)` : 0,
                      borderRadius: '4px',
                      bgcolor:
                        typeof bar.color === 'number'
                          ? theme.brand.chart[bar.color]
                          : `${bar.color}.main`,
                    })}
                  />
                </Box>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 88, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                >
                  {bar.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
