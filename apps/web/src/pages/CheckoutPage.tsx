import { Alert, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Checkout = {
  purchase: {
    id: string;
    status: string;
    terms: { name?: string; amount?: string; currency?: string } | null;
    effectsGranted: boolean;
  };
  payment: {
    provider: string;
    environment: string;
    state: string;
    checkoutUrl: string | null;
    lastErrorCode: string | null;
  };
};
export function CheckoutPage() {
  const { purchaseIntentId = '' } = useParams();
  const [params] = useSearchParams();
  const query = useQuery({
    queryKey: ['checkout', purchaseIntentId],
    queryFn: () => apiRequest<Checkout>(`/api/v1/client/checkouts/${purchaseIntentId}`),
    refetchInterval: ({ state }) => (state.data?.payment.state === 'SUCCEEDED' ? false : 5000),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error">
        This checkout could not be loaded. Sign in again or contact support.
      </Alert>
    );
  const data = query.data!;
  const successful = data.payment.state === 'SUCCEEDED' && data.purchase.effectsGranted;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Secure checkout"
        title={data.purchase.terms?.name ?? 'Service purchase'}
        description="Payment status comes from PayPal verification. Browser return URLs never grant access."
      />
      {params.has('returned') && !successful && (
        <Alert severity="info">
          You returned from PayPal. We are verifying the payment directly with the provider.
        </Alert>
      )}
      {params.has('cancelled') && (
        <Alert severity="warning">
          Checkout was cancelled. No service access has been granted.
        </Alert>
      )}
      <SectionCard>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Chip label={data.payment.provider} />
            <Chip label={data.payment.environment} />
            <Chip
              color={successful ? 'success' : 'default'}
              label={data.payment.state.replaceAll('_', ' ')}
            />
          </Stack>
          <Typography>Purchase status: {data.purchase.status.toLowerCase()}</Typography>
          {successful ? (
            <Alert severity="success">
              Payment confirmed. Your entitlement and included Review Credits are ready.
            </Alert>
          ) : (
            <Alert severity="info">
              No entitlement is granted until the provider confirms a completed payment.
            </Alert>
          )}
          {data.payment.checkoutUrl && !successful && (
            <Button component="a" href={data.payment.checkoutUrl} variant="contained">
              Continue securely with PayPal
            </Button>
          )}
          <Button component={Link} to="/app/support">
            Get payment support
          </Button>
          <Button component={Link} to="/app/services/history">
            View purchase history
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
