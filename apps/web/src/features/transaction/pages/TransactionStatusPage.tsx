import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectIsOwnOrder } from '@/features/account';
import { selectDelivery } from '@/features/checkout';
import { useGetTransactionDeliveryQuery, useGetTransactionQuery } from '@/shared/api/baseApi';
import { isUiError } from '@/shared/api/uiError';
import { DeliveryTracker } from '../components/DeliveryTracker';
import { EditAddressDialog } from '../components/EditAddressDialog';
import { TransactionStatus, type DeliveryRecap } from '../components/TransactionStatus';
import { selectFlowTransactionId, selectPolling } from '../selectors';
import { finishCheckout, pollTransaction, retryPayment } from '../thunks';
import { pollingRestarted } from '../transactionSlice';

function StatusSkeleton() {
  return (
    <Paper
      variant="outlined"
      aria-busy="true"
      sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2.5, sm: 4 }, borderRadius: 2 }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Typography role="status" variant="body2" color="text.secondary">
          Loading your transaction…
        </Typography>
        <Skeleton variant="circular" width={72} height={72} />
        <Skeleton variant="text" width="60%" sx={{ fontSize: '1.5rem' }} />
        <Skeleton variant="rounded" width="100%" height={180} />
        <Skeleton variant="rounded" width="100%" height={48} />
      </Stack>
    </Paper>
  );
}

/** Step 4 as a route (`/transactions/:id`), so the result survives a reload and can be reopened. */
export function TransactionStatusPage() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const polling = useAppSelector(selectPolling);
  const flowTransactionId = useAppSelector(selectFlowTransactionId);
  const flowDelivery = useAppSelector(selectDelivery);
  const isOwnOrder = useAppSelector((state) => selectIsOwnOrder(state, id));
  const { data, error, isLoading, isFetching, refetch } = useGetTransactionQuery(id, {
    refetchOnMountOrArgChange: true,
  });

  const isCurrentFlow = flowTransactionId === id;
  const status = data?.status;
  // The delivery exists only once the payment is approved.
  const tracked = useGetTransactionDeliveryQuery(id, { skip: status !== 'APPROVED' });
  const [editingAddress, setEditingAddress] = useState(false);

  useEffect(() => {
    if (status !== 'PENDING' || polling.timedOut) return undefined;

    const poll = dispatch(pollTransaction(id));
    return () => poll.abort();
  }, [dispatch, id, status, polling.timedOut]);

  const handleBackToStore = () => {
    // Viewing some other transaction must not discard a checkout in progress.
    if (isCurrentFlow) dispatch(finishCheckout());
    void navigate('/');
  };

  if (isLoading || (isFetching && !data)) return <StatusSkeleton />;

  if (!data) {
    const notFound = isUiError(error) && error.status === 404;
    return (
      <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto', alignItems: 'stretch' }}>
        <Typography variant="h2">
          {notFound ? 'Transaction not found' : 'We could not load this transaction'}
        </Typography>
        <Alert
          severity={notFound ? 'warning' : 'error'}
          action={
            notFound ? undefined : (
              <Button color="inherit" size="small" onClick={() => void refetch()}>
                Retry
              </Button>
            )
          }
        >
          {notFound
            ? 'Check the link and try again. If you just paid, your bank statement will show the result.'
            : (error?.message ?? 'Something went wrong. Please try again.')}
        </Alert>
        <Button variant="outlined" size="large" onClick={handleBackToStore}>
          Back to store
        </Button>
      </Stack>
    );
  }

  const delivery: DeliveryRecap | null =
    isCurrentFlow && flowDelivery
      ? {
          fullName: flowDelivery.fullName,
          address: [
            flowDelivery.addressLine1,
            flowDelivery.addressLine2,
            flowDelivery.city,
            flowDelivery.region,
          ]
            .filter(Boolean)
            .join(', '),
        }
      : null;

  return (
    <>
      <TransactionStatus
        transaction={data}
        pollingTimedOut={polling.timedOut}
        delivery={delivery}
        tracking={
          tracked.data && (
            <DeliveryTracker
              delivery={tracked.data}
              showAddress={isCurrentFlow || isOwnOrder}
              onEditAddress={() => setEditingAddress(true)}
            />
          )
        }
        checking={isFetching}
        onBackToStore={handleBackToStore}
        onTryAgain={() => {
          dispatch(retryPayment(data.product.id));
          void navigate('/');
        }}
        onCheckAgain={() => {
          dispatch(pollingRestarted());
          void refetch();
        }}
      />
      {editingAddress && tracked.data && (
        <EditAddressDialog delivery={tracked.data} onClose={() => setEditingAddress(false)} />
      )}
    </>
  );
}
