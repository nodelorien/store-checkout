import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'react-router-dom';
import { useGetSalesSummaryQuery } from '@/shared/api/baseApi';
import type { SalesSummary } from '@/shared/api/types';
import { formatMoney } from '@/shared/lib/formatMoney';
import { ChartFrame } from '@/shared/ui/molecules/charts/ChartFrame';
import { ColumnChart } from '@/shared/ui/molecules/charts/ColumnChart';
import { Meter } from '@/shared/ui/molecules/charts/Meter';
import { RankBars } from '@/shared/ui/molecules/charts/RankBars';
import {
  RANGES,
  STATUS_LABELS,
  TABS,
  TAB_LABELS,
  compactMoney,
  dayLabel,
  hasActivity,
  parseRange,
  parseTab,
  percent,
  type InsightsTab,
} from '../insights';

const STATUS_COLORS = {
  APPROVED: 'success',
  DECLINED: 'error',
  ERROR: 'error',
  VOIDED: 'warning',
  PENDING: 'info',
} as const;
const BRAND_NAMES = { VISA: 'VISA', MASTERCARD: 'MasterCard' } as const;

const orders = (count: number) => `${count} ${count === 1 ? 'order' : 'orders'}`;
const units = (count: number) => `${count} ${count === 1 ? 'unit' : 'units'}`;

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        sx={{ fontSize: { xs: '1.125rem', sm: '1.5rem' }, fontWeight: 600, lineHeight: 1.3 }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

function SalesReport({ summary }: { summary: SalesSummary }) {
  const { totals, currency, salesByDay } = summary;
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <StatTile label="Revenue" value={money(totals.revenueInCents)} />
        <StatTile label="Approved orders" value={String(totals.approvedOrders)} />
        <StatTile label="Average order" value={money(totals.averageOrderInCents)} />
        <StatTile label="Units sold" value={String(totals.unitsSold)} />
      </Box>
      <ChartFrame
        title="Revenue per day"
        description="Approved payments, by the day they were made."
        table={{
          columns: ['Day', 'Revenue', 'Orders'],
          rows: salesByDay.map((day) => [
            dayLabel(day.date),
            money(day.revenueInCents),
            day.orders,
          ]),
        }}
      >
        <ColumnChart
          label={`Revenue per day over the last ${summary.range.days} days`}
          formatAxis={compactMoney}
          data={salesByDay.map((day) => ({
            label: dayLabel(day.date),
            value: day.revenueInCents,
            hint: `${dayLabel(day.date)} · ${money(day.revenueInCents)} · ${orders(day.orders)}`,
          }))}
        />
      </ChartFrame>
    </Stack>
  );
}

function ProductsReport({ summary }: { summary: SalesSummary }) {
  const money = (cents: number) => formatMoney(cents, summary.currency);

  return (
    <ChartFrame
      title="Top products"
      description="The five products with the most revenue from approved payments."
      table={{
        columns: ['Product', 'Revenue', 'Units'],
        rows: summary.topProducts.map((product) => [
          product.name,
          money(product.revenueInCents),
          product.unitsSold,
        ]),
      }}
    >
      {summary.topProducts.length === 0 ? (
        <Typography color="text.secondary">No approved payments in this period.</Typography>
      ) : (
        <RankBars
          items={summary.topProducts.map((product) => ({
            key: product.productId,
            label: product.name,
            caption: units(product.unitsSold),
            bars: [
              { value: product.revenueInCents, color: 0, text: money(product.revenueInCents) },
            ],
          }))}
        />
      )}
    </ChartFrame>
  );
}

function Legend({ items }: { items: string[] }) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {items.map((item, index) => (
        <Stack key={item} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={(theme) => ({
              width: 10,
              height: 10,
              borderRadius: '3px',
              bgcolor: theme.brand.chart[index as 0 | 1],
            })}
          />
          <Typography variant="body2" color="text.secondary">
            {item}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function PaymentsReport({ summary }: { summary: SalesSummary }) {
  const { totals, payments } = summary;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      <ChartFrame
        title="Payment outcomes"
        description="Every payment attempt in the period, by its current status."
        table={{
          columns: ['Status', 'Payments'],
          rows: payments.byStatus.map((entry) => [STATUS_LABELS[entry.status], entry.count]),
        }}
      >
        <Stack spacing={3}>
          <Meter
            value={totals.approvalRate}
            text={percent(totals.approvalRate)}
            caption="Approval rate"
          />
          <RankBars
            items={payments.byStatus.map((entry) => ({
              key: entry.status,
              label: STATUS_LABELS[entry.status],
              bars: [
                {
                  value: entry.count,
                  color: STATUS_COLORS[entry.status],
                  text: String(entry.count),
                },
              ],
            }))}
          />
        </Stack>
      </ChartFrame>
      <ChartFrame
        title="Card brands"
        description="Attempts and approved payments for each card brand."
        legend={<Legend items={['Attempts', 'Approved']} />}
        table={{
          columns: ['Brand', 'Attempts', 'Approved'],
          rows: payments.byCardBrand.map((entry) => [
            BRAND_NAMES[entry.brand],
            entry.attempts,
            entry.approved,
          ]),
        }}
      >
        <RankBars
          items={payments.byCardBrand.map((entry) => ({
            key: entry.brand,
            label: BRAND_NAMES[entry.brand],
            bars: [
              { value: entry.attempts, color: 0, text: `${entry.attempts} attempts` },
              { value: entry.approved, color: 1, text: `${entry.approved} approved` },
            ],
          }))}
        />
      </ChartFrame>
    </Box>
  );
}

const REPORTS: Record<InsightsTab, (props: { summary: SalesSummary }) => React.ReactNode> = {
  sales: SalesReport,
  products: ProductsReport,
  payments: PaymentsReport,
};

/**
 * Store activity in three reports — sales, products, payments — over a chosen period. Aggregates
 * only: the API returns no customer or order details. The period and the tab live in the address.
 */
export function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const days = parseRange(params.get('days'));
  const tab = parseTab(params.get('tab'));
  const { data, error, isFetching, refetch } = useGetSalesSummaryQuery(days, {
    refetchOnMountOrArgChange: true,
  });

  const show = (next: { days?: number; tab?: InsightsTab }) =>
    setParams({ tab: next.tab ?? tab, days: String(next.days ?? days) }, { replace: true });
  const Report = REPORTS[tab];

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' } }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h1" component="h2">
            Insights
          </Typography>
          <Typography color="text.secondary">Store activity over the last {days} days.</Typography>
        </Stack>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          aria-label="Period"
          value={days}
          onChange={(_event, value: number | null) => value && show({ days: value })}
        >
          {RANGES.map((range) => (
            <ToggleButton key={range} value={range} sx={{ px: 2, minHeight: 40 }}>
              {range} days
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_event, value: InsightsTab) => show({ tab: value })}
        aria-label="Reports"
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((name) => (
          <Tab
            key={name}
            value={name}
            label={TAB_LABELS[name]}
            id={`insights-tab-${name}`}
            aria-controls="insights-panel"
            sx={{ minHeight: 48 }}
          />
        ))}
      </Tabs>

      <Box
        role="tabpanel"
        id="insights-panel"
        aria-labelledby={`insights-tab-${tab}`}
        aria-busy={isFetching}
      >
        {error && !data ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void refetch()}>
                Retry
              </Button>
            }
          >
            We could not load the reports. {error.message}
          </Alert>
        ) : !data ? (
          <Stack spacing={2}>
            <Box role="status">
              <Typography variant="body2" color="text.secondary">
                Loading reports…
              </Typography>
            </Box>
            <Skeleton variant="rounded" height={88} />
            <Skeleton variant="rounded" height={280} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            {!hasActivity(data) && (
              <Alert severity="info">There were no payments in this period.</Alert>
            )}
            <Report summary={data} />
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
