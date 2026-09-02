import HistoryRounded from '@mui/icons-material/HistoryRounded';
import LocalActivityRounded from '@mui/icons-material/LocalActivityRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Service = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  entitlementType: string;
  includedQuantity: number;
  includedReviewCredits: number;
  prerequisiteCode: string | null;
  eligibility: string | null;
  checkoutAvailable: boolean;
};
export type CommerceData = {
  balance: { available: number; reserved: number; consumed: number; expired: number };
  entitlements: Array<{
    id: string;
    serviceType: string;
    status: string;
    quantityGranted: number;
    quantityUsed: number;
    grantedAt: string;
    expiresAt: string | null;
    product: { name: string; version: number } | null;
    purchaseId: string | null;
  }>;
  creditTransactions: Array<{
    id: string;
    transactionType: string;
    availableDelta: number;
    reservedDelta: number;
    consumedDelta: number;
    expiredDelta: number;
    reason: string | null;
    createdAt: string;
  }>;
  purchases: Purchase[];
  pagination?: {
    entitlementPage: number;
    transactionPage: number;
    pageSize: number;
    entitlementTotal: number;
    transactionTotal: number;
  };
};
type Purchase = {
  id: string;
  status: string;
  amount: string;
  currency: string;
  purchasedAt: string | null;
  createdAt: string;
  terms: { name?: string; version?: number } | null;
  product: { name: string; version: number } | null;
  reviewCreditsGranted: number;
  payment?: { provider: string; providerEnvironment: string; state: string } | null;
};
const money = (amount: string, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
const words = (value: string) => value.replaceAll('_', ' ').toLowerCase();

function PurchaseButton({ service }: { service: Service }) {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ purchaseId: string }>('/api/v1/client/checkouts', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ productId: service.id }),
      }),
    onSuccess: ({ purchaseId }) => navigate(`/app/checkout/${purchaseId}`),
  });
  return (
    <Stack spacing={1}>
      <Button
        disabled={!service.checkoutAvailable || mutation.isPending}
        fullWidth
        variant="contained"
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending
          ? 'Starting secure checkout…'
          : service.checkoutAvailable
            ? 'Purchase securely'
            : 'Checkout temporarily unavailable'}
      </Button>
      {mutation.isError && (
        <Alert severity="error">
          Checkout could not be started. No charge or entitlement was created.
        </Alert>
      )}
    </Stack>
  );
}

export function ClientServicesSummary({ data }: { data: CommerceData }) {
  return (
    <SectionCard>
      <Stack spacing={2}>
        <Typography variant="h3">Services & Review Credits</Typography>
        <Stack direction="row" spacing={1}>
          <Chip color="success" label={`${data.balance.available} available credits`} />
          <Chip label={`${data.balance.reserved} reserved`} />
          <Chip
            label={`${data.entitlements.filter((item) => item.status === 'ACTIVE').length} active entitlements`}
          />
        </Stack>
        {data.purchases.length ? (
          <Typography color="text.secondary">
            Most recent purchase:{' '}
            {data.purchases[0]!.terms?.name ??
              data.purchases[0]!.product?.name ??
              'Historical service'}{' '}
            · {data.purchases[0]!.status.toLowerCase()}
          </Typography>
        ) : (
          <Typography color="text.secondary">No commercial purchase history.</Typography>
        )}
        <Alert severity="info">
          Consultants can view governed service access but cannot mint credits, create paid
          purchases, or perform refunds.
        </Alert>
      </Stack>
    </SectionCard>
  );
}

export function ServicesPage() {
  const query = useQuery({
    queryKey: ['available-services'],
    queryFn: () => apiRequest<{ services: Service[] }>('/api/v1/client/services'),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
        Available services could not be loaded. No checkout was started.
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Services"
        title="Choose the right support"
        description="Current product terms, eligibility, and included access come directly from the governed catalog."
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={Link} to="/app/services/active">
              Credits & active
            </Button>
            <Button component={Link} to="/app/services/history">
              Purchase history
            </Button>
          </Stack>
        }
      />
      {query.data!.services.length === 0 && (
        <Alert severity="info">
          No services are currently offered. Existing access and purchases remain in your history.
        </Alert>
      )}
      <Grid container spacing={2}>
        {query.data!.services.map((service) => (
          <Grid key={service.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <SectionCard variant="interactive" sx={{ height: '100%' }}>
              <Stack spacing={2} sx={{ height: '100%' }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <LocalActivityRounded color="primary" />
                  <Chip label={`Version ${service.version}`} size="small" />
                </Stack>
                <Box>
                  <Typography variant="h3">{service.name}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {service.description}
                  </Typography>
                </Box>
                <Typography variant="h2">{money(service.price, service.currency)}</Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {service.includedQuantity} service unit(s)
                  {service.includedReviewCredits
                    ? ` · ${service.includedReviewCredits} Review Credit(s)`
                    : ''}
                </Typography>
                <Alert severity={service.prerequisiteCode ? 'info' : 'success'}>
                  {service.eligibility ?? 'No additional prerequisite is configured.'}
                </Alert>
                <Box sx={{ mt: 'auto !important' }}>
                  <PurchaseButton service={service} />
                  <Typography variant="caption">
                    No payment or outcome is implied. Access begins only after a verified commercial
                    grant.
                  </Typography>
                </Box>
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export function ActiveServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const entitlementPage = Math.max(1, Number(searchParams.get('entitlementPage')) || 1);
  const transactionPage = Math.max(1, Number(searchParams.get('transactionPage')) || 1);
  const query = useQuery({
    queryKey: ['active-services', entitlementPage, transactionPage],
    queryFn: () =>
      apiRequest<CommerceData>(
        `/api/v1/client/services/active?entitlementPage=${entitlementPage}&transactionPage=${transactionPage}&pageSize=20`,
      ),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
        Credits and active services could not be loaded. Your balances were not changed.
      </Alert>
    );
  const data = query.data!;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Services"
        title="Credits & active services"
        description="Review Credit balances are calculated from the append-only ledger and cannot be edited here."
        actions={
          <Button component={Link} to="/app/services">
            Available services
          </Button>
        }
      />
      <Grid container spacing={2}>
        {[
          ['Available', data.balance.available],
          ['Reserved', data.balance.reserved],
          ['Used', data.balance.consumed],
          ['Expired', data.balance.expired],
        ].map(([label, value]) => (
          <Grid key={String(label)} size={{ xs: 6, md: 3 }}>
            <SectionCard>
              <Typography variant="overline">{label}</Typography>
              <Typography variant="h2">{value}</Typography>
              <Typography color="text.secondary">Review Credits</Typography>
            </SectionCard>
          </Grid>
        ))}
      </Grid>
      <SectionCard>
        <Stack spacing={2} divider={<Divider />}>
          <Typography variant="h3">Service access</Typography>
          {data.entitlements.length === 0 ? (
            <Alert severity="info">No service entitlements yet.</Alert>
          ) : (
            data.entitlements.map((item) => (
              <Stack
                key={item.id}
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>
                    {item.product?.name ?? words(item.serviceType)}
                  </Typography>
                  <Typography color="text.secondary">
                    Granted {new Date(item.grantedAt).toLocaleDateString()} · {item.quantityUsed} of{' '}
                    {item.quantityGranted} used
                  </Typography>
                </Box>
                <Chip
                  label={words(item.status)}
                  color={item.status === 'ACTIVE' ? 'success' : 'default'}
                />
              </Stack>
            ))
          )}
        </Stack>
        {data.pagination && (
          <DataPagination
            page={entitlementPage}
            pageSize={data.pagination.pageSize}
            total={data.pagination.entitlementTotal}
            hasMore={entitlementPage * data.pagination.pageSize < data.pagination.entitlementTotal}
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              next.set('entitlementPage', String(nextPage));
              setSearchParams(next);
            }}
            loading={query.isFetching}
          />
        )}
      </SectionCard>
      <SectionCard>
        <Stack spacing={2} divider={<Divider />}>
          <Typography variant="h3">Credit ledger</Typography>
          {data.creditTransactions.length === 0 ? (
            <Typography color="text.secondary">No Review Credit activity.</Typography>
          ) : (
            data.creditTransactions.map((item) => (
              <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{words(item.transactionType)}</Typography>
                  <Typography variant="caption">
                    {item.reason ?? new Date(item.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 900 }}>
                  {item.availableDelta > 0 ? '+' : ''}
                  {item.availableDelta || item.reservedDelta}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>
        {data.pagination && (
          <DataPagination
            page={transactionPage}
            pageSize={data.pagination.pageSize}
            total={data.pagination.transactionTotal}
            hasMore={transactionPage * data.pagination.pageSize < data.pagination.transactionTotal}
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              next.set('transactionPage', String(nextPage));
              setSearchParams(next);
            }}
            loading={query.isFetching}
          />
        )}
      </SectionCard>
    </Stack>
  );
}

export function PurchaseHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const query = useQuery({
    queryKey: ['purchase-history', search, status, page],
    queryFn: () =>
      apiRequest<{ purchases: Purchase[]; total: number; pageSize: number; hasMore: boolean }>(
        `/api/v1/client/services/history?${params}`,
      ),
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
        Purchase history could not be loaded. Adjust the filters or retry.
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Services"
        title="Purchase history"
        description="Historical product terms remain frozen even when today’s catalog changes."
        actions={
          <Button component={Link} to="/app/services">
            Available services
          </Button>
        }
      />
      <SectionCard variant="operational">
        <Stack spacing={2}>
          <DataNavigationToolbar
            searchLabel="Search purchase history"
            searchPlaceholder="Service name or product key"
            searchValue={search}
            onSearchChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value) next.set('search', value);
              else next.delete('search');
              next.set('page', '1');
              setSearchParams(next);
            }}
            activeFilters={status ? [`Status: ${words(status)}`] : []}
            onClearFilters={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('status');
              next.set('page', '1');
              setSearchParams(next);
            }}
            resultLabel={`${query.data!.total} purchases`}
            loading={query.isFetching}
          >
            <TextField
              select
              label="Purchase status"
              value={status}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set('status', event.target.value);
                else next.delete('status');
                next.set('page', '1');
                setSearchParams(next);
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All statuses</MenuItem>
              {['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'].map((value) => (
                <MenuItem key={value} value={value}>
                  {words(value)}
                </MenuItem>
              ))}
            </TextField>
          </DataNavigationToolbar>
          <Stack spacing={1.5}>
            {query.data!.purchases.length === 0 ? (
              <Alert severity="info">No commercial purchase history yet.</Alert>
            ) : (
              query.data!.purchases.map((purchase) => (
                <Paper key={purchase.id} variant="outlined" sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Stack>
                      <Stack direction="row" spacing={1}>
                        <HistoryRounded color="primary" />
                        <Typography variant="h3">
                          {purchase.terms?.name ?? purchase.product?.name ?? 'Historical service'}
                        </Typography>
                      </Stack>
                      <Typography color="text.secondary">
                        Terms version{' '}
                        {purchase.terms?.version ?? purchase.product?.version ?? 'legacy'} ·{' '}
                        {new Date(purchase.purchasedAt ?? purchase.createdAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption">
                        {purchase.reviewCreditsGranted} Review Credits granted
                        {purchase.payment
                          ? ` · ${purchase.payment.provider} ${purchase.payment.providerEnvironment} · ${words(purchase.payment.state)}`
                          : ''}
                      </Typography>
                    </Stack>
                    <Stack sx={{ alignItems: { sm: 'flex-end' } }}>
                      <Typography variant="h3">
                        {money(purchase.amount, purchase.currency)}
                      </Typography>
                      <Chip label={words(purchase.status)} />
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
          <DataPagination
            page={page}
            pageSize={query.data!.pageSize}
            total={query.data!.total}
            hasMore={query.data!.hasMore}
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              next.set('page', String(nextPage));
              setSearchParams(next);
            }}
            loading={query.isFetching}
          />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
