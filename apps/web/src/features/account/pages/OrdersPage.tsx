import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useGetTransactionQuery } from '@/shared/api/baseApi';
import type { TransactionStatus } from '@/shared/api/types';
import { Reveal } from '@/shared/motion';
import { Money } from '@/shared/ui/atoms/Money';
import type { OrderEntry } from '../ordersSlice';
import { selectOrders } from '../selectors';

const STATUS: Record<TransactionStatus, { label: string; color: 'success' | 'error' | 'info' }> = {
  APPROVED: { label: 'Approved', color: 'success' },
  DECLINED: { label: 'Declined', color: 'error' },
  ERROR: { label: 'Failed', color: 'error' },
  VOIDED: { label: 'Voided', color: 'error' },
  PENDING: { label: 'Processing', color: 'info' },
};

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function formatPlacedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

/** One purchase: what this device remembers, completed with its current state from the API. */
function OrderRow({ order, index }: { order: OrderEntry; index: number }) {
  const { data, isError } = useGetTransactionQuery(order.id);
  const status = data ? STATUS[data.status] : null;

  return (
    <Reveal component="li" index={index}>
      <Paper
        component={RouterLink}
        to={`/transactions/${encodeURIComponent(order.id)}`}
        variant="outlined"
        aria-label={`Order ${order.reference}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 2,
          color: 'inherit',
          textDecoration: 'none',
          minWidth: 0,
          '&:hover': { borderColor: 'primary.light' },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {data ? `${data.product.name} × ${data.quantity}` : <Skeleton width="60%" />}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {order.reference} · {formatPlacedAt(order.placedAt)}
          </Typography>
          {isError && (
            <Typography variant="body2" color="text.secondary">
              Details are unavailable right now.
            </Typography>
          )}
        </Box>
        <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
          {data && (
            <Typography sx={{ fontWeight: 600 }}>
              <Money amountInCents={data.amounts.totalInCents} currency={data.currency} />
            </Typography>
          )}
          {status && (
            <Chip size="small" variant="outlined" color={status.color} label={status.label} />
          )}
        </Stack>
        <ChevronRightIcon aria-hidden sx={{ color: 'text.secondary', flexShrink: 0 }} />
      </Paper>
    </Reveal>
  );
}

/** Purchases made from this device, newest first. */
export function OrdersPage() {
  const orders = useAppSelector(selectOrders);

  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: 'auto' }}>
      <Stack spacing={0.5}>
        <Typography variant="h1" component="h2">
          My orders
        </Typography>
        <Typography color="text.secondary">Purchases made from this device.</Typography>
      </Stack>

      {orders.length === 0 ? (
        <Stack
          role="status"
          spacing={1.5}
          sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}
        >
          <Typography variant="h3">No orders yet</Typography>
          <Typography color="text.secondary">
            When you buy something it will appear here with its status.
          </Typography>
          <Button component={RouterLink} to="/" variant="contained">
            Browse products
          </Button>
        </Stack>
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {orders.map((order, index) => (
            <OrderRow key={order.id} order={order} index={index} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
