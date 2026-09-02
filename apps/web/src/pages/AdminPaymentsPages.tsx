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
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { humanizeCode } from '../components/common/labels';
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
const providerLabel = (provider: string) =>
  provider === 'BOFA_MERCHANT' ? 'Bank of America Merchant Services' : humanizeCode(provider);
export function AdminPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const provider = searchParams.get('provider') ?? '';
  const state = searchParams.get('state') ?? '';
  const search = searchParams.get('search') ?? '';
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };
  const query = useQuery({
    queryKey: ['admin-payments', page, provider, state],
    queryFn: () =>
      apiRequest<{ payments: Payment[]; total: number; pageSize: number }>(
        `/api/v1/admin/payments?page=${page}&pageSize=20${provider ? `&provider=${provider}` : ''}${state ? `&state=${state}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
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
      <Alert severity="error" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
        Payments are unavailable. If retry fails, renew MFA verification and try again; no payment
        operation was performed.
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Commerce"
        title="Payments"
        description="Provider-neutral payment, refund, dispute, and reconciliation operations."
      />
      <DataNavigationToolbar
        searchLabel="Search payments"
        searchPlaceholder="Client, product, or provider reference"
        searchValue={search}
        onSearchChange={(value) => updateFilter('search', value)}
        activeFilters={[
          ...(provider ? [`Provider: ${providerLabel(provider)}`] : []),
          ...(state ? [`State: ${humanizeCode(state)}`] : []),
        ]}
        onClearFilters={() => setSearchParams({ page: '1' })}
        resultLabel={`${query.data!.total} payments`}
        loading={query.isFetching}
      >
        <TextField
          select
          label="Provider"
          value={provider}
          onChange={(event) => {
            updateFilter('provider', event.target.value);
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
            updateFilter('state', event.target.value);
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
              {humanizeCode(value)}
            </MenuItem>
          ))}
        </TextField>
      </DataNavigationToolbar>
      {query.data!.payments.length === 0 && (
        <Alert severity="info">No payments match the current search and filters.</Alert>
      )}
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
                {providerLabel(payment.provider)} · {humanizeCode(payment.environment)} ·{' '}
                {new Date(payment.createdAt).toLocaleString()}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip label={humanizeCode(payment.state)} />
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
      <DataPagination
        page={page}
        pageSize={query.data!.pageSize}
        total={query.data!.total}
        hasMore={page * query.data!.pageSize < query.data!.total}
        onPageChange={(nextPage) => {
          const next = new URLSearchParams(searchParams);
          next.set('page', String(nextPage));
          setSearchParams(next);
        }}
        loading={query.isFetching}
      />
      <SectionCard>
        <Stack spacing={1}>
          <Typography variant="h3">Recent refunds</Typography>
          {refunds.data?.refunds.map((item) => (
            <Typography key={item.id}>
              {providerLabel(item.provider)} · {item.amount} {item.currency} · {humanizeCode(item.status)}
            </Typography>
          )) ?? <Typography color="text.secondary">No refund records.</Typography>}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={1}>
          <Typography variant="h3">Open dispute activity</Typography>
          {disputes.data?.disputes.map((item) => (
            <Typography key={item.id}>
              {providerLabel(item.provider)} · {item.providerDisputeId} · {humanizeCode(item.status)}
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
        title={`${providerLabel(query.data!.payment.provider)} payment`}
        description="Verified provider events and canonical transitions. Sensitive provider credentials are never exposed."
        actions={<Button component={Link} to="/admin/payments" variant="outlined">Back to payments</Button>}
      />
      <SectionCard>
        <Stack spacing={1}>
          <Chip label={humanizeCode(query.data!.payment.state)} />
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
              Refund {item.amount} {item.currency} · {humanizeCode(item.status)}
            </Typography>
          ))}
          {query.data!.disputes.map((item) => (
            <Typography key={item.id}>
              Dispute {item.providerDisputeId} · {humanizeCode(item.status)}
            </Typography>
          ))}
          {query.data!.reconciliations.map((item) => (
            <Typography key={item.id}>
              Reconciliation · {humanizeCode(item.status)}
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
          <Typography>{humanizeCode(gateway.environment)} environment</Typography>
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
              onClick={() => {
                if (!config) return;
                const action = config.enabledForNewPayments ? 'Disable' : 'Enable';
                if (window.confirm(`${action} ${displayName} for future payments? Historical payments will continue using their original provider.`)) {
                  update.mutate({ action: 'enabled', body: { enabled: !config.enabledForNewPayments } });
              }
              }}
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
