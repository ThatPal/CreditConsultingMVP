import {
  Alert,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('');
  const [state, setState] = useState('');
  const query = useQuery({
    queryKey: ['admin-payments', page, provider, state],
    queryFn: () =>
      apiRequest<{ payments: Payment[]; total: number; pageSize: number }>(
        `/api/v1/admin/payments?page=${page}${provider ? `&provider=${provider}` : ''}${state ? `&state=${state}` : ''}`,
      ),
  });
  const refunds = useQuery({
    queryKey: ['admin-refunds'],
    queryFn: () =>
      apiRequest<{
        refunds: Array<{
          id: string;
          provider: string;
          amount: string;
          currency: string;
          status: string;
        }>;
      }>('/api/v1/admin/refunds?pageSize=5'),
  });
  const disputes = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () =>
      apiRequest<{
        disputes: Array<{
          id: string;
          provider: string;
          providerDisputeId: string;
          status: string;
        }>;
      }>('/api/v1/admin/disputes?pageSize=5'),
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
        description="Provider-neutral payment, refund, dispute, and reconciliation operations."
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          select
          label="Provider"
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All providers</MenuItem>
          <MenuItem value="PAYPAL">PayPal</MenuItem>
          <MenuItem value="STRIPE">Stripe</MenuItem>
          <MenuItem value="BOFA_MERCHANT">BofA</MenuItem>
        </TextField>
        <TextField
          select
          label="State"
          value={state}
          onChange={(event) => {
            setState(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All states</MenuItem>
          {[
            'PENDING',
            'AWAITING_CUSTOMER',
            'PROCESSING',
            'SUCCEEDED',
            'FAILED',
            'CANCELLED',
            'PARTIALLY_REFUNDED',
            'REFUNDED',
          ].map((value) => (
            <MenuItem key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
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
      <Stack direction="row" spacing={1}>
        <Button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
          Previous
        </Button>
        <Typography>Page {page}</Typography>
        <Button
          disabled={page * query.data!.pageSize >= query.data!.total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </Stack>
      <SectionCard>
        <Stack spacing={1}>
          <Typography variant="h3">Recent refunds</Typography>
          {refunds.data?.refunds.map((item) => (
            <Typography key={item.id}>
              {item.provider} · {item.amount} {item.currency} · {item.status}
            </Typography>
          )) ?? <Typography color="text.secondary">No refund records.</Typography>}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={1}>
          <Typography variant="h3">Open dispute activity</Typography>
          {disputes.data?.disputes.map((item) => (
            <Typography key={item.id}>
              {item.provider} · {item.providerDisputeId} · {item.status}
            </Typography>
          )) ?? <Typography color="text.secondary">No dispute records.</Typography>}
        </Stack>
      </SectionCard>
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
        refunds: Array<{ id: string; amount: string; currency: string; status: string }>;
        disputes: Array<{ id: string; providerDisputeId: string; status: string }>;
        reconciliations: Array<{ id: string; status: string; corrected: boolean }>;
      }>(`/api/v1/admin/payments/${paymentId}`),
  });
  const client = useQueryClient();
  const [refundAmount, setRefundAmount] = useState('');
  const refund = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ amount: refundAmount }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-payment', paymentId] }),
  });
  const reconcile = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/payments/${paymentId}/reconcile`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-payment', paymentId] }),
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Refund amount"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              inputMode="decimal"
            />
            <Button
              variant="contained"
              disabled={!refundAmount || refund.isPending}
              onClick={() =>
                window.confirm('Issue this refund through the original payment provider?') &&
                refund.mutate()
              }
            >
              Issue refund
            </Button>
            <Button disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>
              Reconcile provider status
            </Button>
          </Stack>
          {(refund.isError || reconcile.isError) && (
            <Alert severity="warning">
              The operation was blocked or unavailable. No alternate provider was used.
            </Alert>
          )}
          {query.data!.refunds.map((item) => (
            <Typography key={item.id}>
              Refund {item.amount} {item.currency} · {item.status}
            </Typography>
          ))}
          {query.data!.disputes.map((item) => (
            <Typography key={item.id}>
              Dispute {item.providerDisputeId} · {item.status}
            </Typography>
          ))}
          {query.data!.reconciliations.map((item) => (
            <Typography key={item.id}>
              Reconciliation · {item.status}
              {item.corrected ? ' · corrected' : ''}
            </Typography>
          ))}
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
function AdminGatewayPage({ provider }: { provider: 'paypal' | 'stripe' | 'bofa' }) {
  const displayName =
    provider === 'paypal'
      ? 'PayPal'
      : provider === 'stripe'
        ? 'Stripe'
        : 'Bank of America Merchant Services';
  const query = useQuery({
    queryKey: [provider, 'health'],
    queryFn: () =>
      apiRequest<{
        gateway: {
          provider: string;
          environment: string;
          configured: boolean;
          healthy: boolean;
          connectionVerified?: boolean;
          message: string;
          capabilities?: {
            checkout: string;
            webhooks: boolean;
            statusRetrieval: boolean;
            refund: string;
            reconciliation: string;
          };
        };
      }>(`/api/v1/admin/integrations/${provider}`),
  });
  const client = useQueryClient();
  const canonicalProvider =
    provider === 'paypal' ? 'PAYPAL' : provider === 'stripe' ? 'STRIPE' : 'BOFA_MERCHANT';
  const configs = useQuery({
    queryKey: ['payment-gateways'],
    queryFn: () =>
      apiRequest<{
        gateways: Array<{
          provider: string;
          enabledForNewPayments: boolean;
          defaultForCheckout: boolean;
          connected: boolean;
        }>;
      }>('/api/v1/admin/payment-gateways'),
  });
  const config = configs.data?.gateways.find((item) => item.provider === canonicalProvider);
  const update = useMutation({
    mutationFn: ({ action, body }: { action: 'default' | 'enabled'; body?: unknown }) =>
      apiRequest(`/api/v1/admin/payment-gateways/${canonicalProvider}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['payment-gateways'] }),
  });
  const testConnection = useMutation({
    mutationFn: () => apiRequest(`/api/v1/admin/integrations/${provider}/test`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [provider, 'health'] });
      client.invalidateQueries({ queryKey: ['payment-gateways'] });
    },
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
            label={
              gateway.healthy
                ? gateway.connectionVerified === false
                  ? 'Configured'
                  : 'Healthy'
                : 'Unavailable'
            }
          />
          <Typography>{gateway.environment}</Typography>
          <Alert severity={gateway.configured ? 'info' : 'warning'}>{gateway.message}</Alert>
          {gateway.capabilities && (
            <Typography color="text.secondary">
              Checkout: {gateway.capabilities.checkout.toLowerCase().replaceAll('_', ' ')} ·
              notifications: {gateway.capabilities.webhooks ? 'verified merchant POST' : 'none'} ·
              status retrieval: {gateway.capabilities.statusRetrieval ? 'available' : 'unsupported'}
              {' · '}refund: {gateway.capabilities.refund.toLowerCase().replaceAll('_', ' ')} ·
              reconciliation:{' '}
              {gateway.capabilities.reconciliation.toLowerCase().replaceAll('_', ' ')}
            </Typography>
          )}
          {config && (
            <Typography color="text.secondary">
              {config.connected ? 'Connected' : 'Connection not verified'} ·{' '}
              {config.enabledForNewPayments
                ? 'Enabled for new payments'
                : 'Historical operations only'}{' '}
              · {config.defaultForCheckout ? 'Current default' : 'Not default'}
            </Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>
              Test connection
            </Button>
            <Button
              disabled={
                !config ||
                config.defaultForCheckout ||
                !config.enabledForNewPayments ||
                update.isPending
              }
              onClick={() =>
                window.confirm(`Make ${displayName} the default for future checkout?`) &&
                update.mutate({ action: 'default' })
              }
            >
              Set as default
            </Button>
            <Button
              disabled={!config || config.defaultForCheckout || update.isPending}
              onClick={() =>
                config &&
                update.mutate({
                  action: 'enabled',
                  body: { enabled: !config.enabledForNewPayments },
                })
              }
            >
              {config?.enabledForNewPayments
                ? 'Disable for new payments'
                : 'Enable for new payments'}
            </Button>
          </Stack>
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

export function AdminBofaPage() {
  return <AdminGatewayPage provider="bofa" />;
}
