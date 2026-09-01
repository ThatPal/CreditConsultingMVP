import { Alert, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Payment = {
  id: string;
  provider: string;
  environment: string;
  state: string;
  amount: string;
  currency: string;
  createdAt: string;
  client?: { firstName: string; lastName: string };
};
export function AdminPaymentsPage() {
  const query = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => apiRequest<{ payments: Payment[]; total: number }>('/api/v1/admin/payments'),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error">Payments are unavailable or your step-up verification expired.</Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Commerce"
        title="Payments"
        description="Provider-neutral payment operations. No refund or dispute actions are available in this sprint."
      />
      {query.data!.payments.map((payment) => (
        <SectionCard key={payment.id} variant="interactive">
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between' }}>
            <Stack>
              <Typography variant="h3">
                {payment.client
                  ? `${payment.client.firstName} ${payment.client.lastName}`
                  : 'Client payment'}
              </Typography>
              <Typography color="text.secondary">
                {payment.provider} · {payment.environment} ·{' '}
                {new Date(payment.createdAt).toLocaleString()}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip label={payment.state.replaceAll('_', ' ')} />
              <Typography>
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: payment.currency,
                }).format(Number(payment.amount))}
              </Typography>
              <Button component={Link} to={`/admin/payments/${payment.id}`}>
                Inspect
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ))}
    </Stack>
  );
}
export function AdminPaymentDetailPage() {
  const { paymentId = '' } = useParams();
  const query = useQuery({
    queryKey: ['admin-payment', paymentId],
    queryFn: () =>
      apiRequest<{
        payment: Payment;
        events: Array<{
          id: string;
          eventType: string;
          disposition: string;
          normalizedState: string;
          occurredAt: string;
        }>;
      }>(`/api/v1/admin/payments/${paymentId}`),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError) return <Alert severity="error">Payment detail is unavailable.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Payment review"
        title={`${query.data!.payment.provider} payment`}
        description="Verified provider events and canonical transitions. Sensitive provider credentials are never exposed."
      />
      <SectionCard>
        <Stack spacing={1}>
          <Chip label={query.data!.payment.state} />
          <Typography>
            {query.data!.payment.amount} {query.data!.payment.currency}
          </Typography>
          {query.data!.events.map((event) => (
            <Typography key={event.id}>
              {event.eventType} · {event.normalizedState} · {event.disposition}
            </Typography>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
function AdminGatewayPage({ provider }: { provider: 'paypal' | 'stripe' }) {
  const displayName = provider === 'paypal' ? 'PayPal' : 'Stripe';
  const query = useQuery({
    queryKey: [provider, 'health'],
    queryFn: () =>
      apiRequest<{
        gateway: {
          provider: string;
          environment: string;
          configured: boolean;
          healthy: boolean;
          message: string;
        };
      }>(`/api/v1/admin/integrations/${provider}`),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error">
        Gateway status requires current MFA step-up and payment access.
      </Alert>
    );
  const gateway = query.data!.gateway;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Integration"
        title={`${displayName} gateway`}
        description="Test configuration health only. Credentials remain environment-managed and are never displayed."
      />
      <SectionCard>
        <Stack spacing={2}>
          <Chip
            color={gateway.healthy ? 'success' : 'warning'}
            label={gateway.healthy ? 'Healthy' : 'Unavailable'}
          />
          <Typography>{gateway.environment}</Typography>
          <Alert severity={gateway.configured ? 'info' : 'warning'}>{gateway.message}</Alert>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function AdminPayPalPage() {
  return <AdminGatewayPage provider="paypal" />;
}

export function AdminStripePage() {
  return <AdminGatewayPage provider="stripe" />;
}
