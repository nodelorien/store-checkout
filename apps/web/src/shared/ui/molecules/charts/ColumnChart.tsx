import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { labelIndexes, niceMax, ratio } from './scale';

export interface ColumnDatum {
  label: string;
  value: number;
  /** Full text shown on hover, e.g. "9 Oct · $ 200.400 · 1 order". */
  hint: string;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  /** Short text for the value axis. */
  formatAxis: (value: number) => string;
  /** What the picture shows, for assistive technology (the table view has the numbers). */
  label: string;
}

/**
 * Drawn in a coordinate space close to its real size, so text stays legible: a narrow one for
 * phones, a wide one otherwise. The picture then scales to its container.
 */
const SIZES = { narrow: { width: 340, labels: 4 }, wide: { width: 640, labels: 7 } } as const;
const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const MAX_BAR = 28;
const RADIUS = 4;

/** A column whose top is rounded and whose base sits square on the baseline. */
function columnPath(x: number, width: number, height: number): string {
  const base = PAD.top + PLOT_HEIGHT;
  const radius = Math.min(RADIUS, width / 2, height);
  const top = base - height;
  return `M${x} ${base}V${top + radius}Q${x} ${top} ${x + radius} ${top}H${x + width - radius}Q${x + width} ${top} ${x + width} ${top + radius}V${base}Z`;
}

/** One series over time as thin columns: single hue, recessive grid, a tooltip per column. */
export function ColumnChart({ data, formatAxis, label }: ColumnChartProps) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const { width: WIDTH, labels } = narrow ? SIZES.narrow : SIZES.wide;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const max = niceMax(Math.max(0, ...data.map((datum) => datum.value)));
  const slot = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(MAX_BAR, Math.max(2, slot - 2));
  const ticks = [0, max / 2, max];
  const printed = new Set(labelIndexes(data.length, labels));

  return (
    <Box
      component="svg"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
    >
      {ticks.map((tick) => {
        const y = PAD.top + PLOT_HEIGHT * (1 - ratio(tick, max));
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              stroke={theme.palette.divider}
              strokeDasharray={tick === 0 ? undefined : '2 4'}
            />
            <text
              x={PAD.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="12"
              fill={theme.palette.text.secondary}
            >
              {formatAxis(tick)}
            </text>
          </g>
        );
      })}

      {data.map((datum, index) => {
        const x = PAD.left + slot * index + (slot - barWidth) / 2;
        const height = PLOT_HEIGHT * ratio(datum.value, max);
        return (
          <Tooltip key={datum.label} title={datum.hint} arrow placement="top">
            <g data-testid="chart-column">
              {/* The hit area is the whole slot, so thin and empty columns are easy to point at. */}
              <rect
                x={PAD.left + slot * index}
                y={PAD.top}
                width={slot}
                height={PLOT_HEIGHT}
                fill="transparent"
              />
              {height > 0 && (
                <path d={columnPath(x, barWidth, height)} fill={theme.brand.chart[0]} />
              )}
              {printed.has(index) && (
                <text
                  x={PAD.left + slot * index + slot / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill={theme.palette.text.secondary}
                >
                  {datum.label}
                </text>
              )}
            </g>
          </Tooltip>
        );
      })}
    </Box>
  );
}
