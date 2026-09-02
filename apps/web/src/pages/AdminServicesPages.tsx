import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Version = {
  id: string;
  version: number;
  status: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  entitlementType: string;
  includedQuantity: number;
  includedReviewCredits: number;
  prerequisiteCode: string | null;
  clientEligibilityCopy: string | null;
  effectiveAt: string | null;
  createdAt: string;
  _count?: { purchases: number };
};
type Product = {
  id: string;
  key: string;
  active: boolean;
  currentVersion: number | null;
  updatedAt: string;
  versions: Version[];
};

const emptyTerms = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  entitlementType: 'CREDIT_PROFILE_REVIEW',
  includedQuantity: 1,
  includedReviewCredits: 1,
  prerequisiteCode: null as string | null,
  clientEligibilityCopy: null as string | null,
};

function TermsFields({
  value,
  onChange,
}: {
  value: typeof emptyTerms;
  onChange: (value: typeof emptyTerms) => void;
}) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Client-facing name"
        required
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
      />
      <TextField
        label="Description"
        required
        multiline
        minRows={2}
        value={value.description}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Price"
          required
          value={value.price}
          onChange={(event) => onChange({ ...value, price: event.target.value })}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />
        <TextField
          label="Currency"
          required
          value={value.currency}
          onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })}
        />
      </Stack>
      <TextField
        select
        label="Entitlement"
        value={value.entitlementType}
        onChange={(event) => onChange({ ...value, entitlementType: event.target.value })}
      >
        <MenuItem value="CREDIT_PROFILE_REVIEW">Credit Profile Review</MenuItem>
        <MenuItem value="CREDIT_CARD_ROUND">Credit Card Round</MenuItem>
        <MenuItem value="MAJOR_APPLICATION_READINESS">Major Application Readiness</MenuItem>
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          type="number"
          label="Included units"
          value={value.includedQuantity}
          onChange={(event) => onChange({ ...value, includedQuantity: Number(event.target.value) })}
        />
        <TextField
          type="number"
          label="Review Credits"
          value={value.includedReviewCredits}
          onChange={(event) =>
            onChange({ ...value, includedReviewCredits: Number(event.target.value) })
          }
        />
      </Stack>
      <TextField
        label="Client eligibility copy"
        value={value.clientEligibilityCopy ?? ''}
        onChange={(event) =>
          onChange({ ...value, clientEligibilityCopy: event.target.value || null })
        }
      />
    </Stack>
  );
}

export function AdminServicesPage() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [newKey, setNewKey] = useState('');
  const [newTerms, setNewTerms] = useState(emptyTerms);
  const queryClient = useQueryClient();
  const params = new URLSearchParams({
    search,
    page: String(page),
    pageSize: '20',
    ...(active ? { active } : {}),
  });
  const query = useQuery({
    queryKey: ['admin-products', search, active, page],
    queryFn: () =>
      apiRequest<{ products: Product[]; total: number; pageSize: number }>(
        `/api/v1/admin/service-products?${params}`,
      ),
    placeholderData: (value) => value,
  });
  const createProduct = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/admin/service-products', {
        method: 'POST',
        headers: { 'Idempotency-Key': `create-product-${newKey}-${Date.now()}` },
        body: JSON.stringify({ key: newKey, terms: newTerms }),
      }),
    onSuccess: () => {
      setNewKey('');
      setNewTerms(emptyTerms);
      return queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
  const submitNewProduct = (event: FormEvent) => {
    event.preventDefault();
    createProduct.mutate();
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Administration"
        title="Services & products"
        description="Govern immutable commercial versions, availability, pricing, and entitlement mappings."
      />
      <SectionCard>
        <Box component="form" onSubmit={submitNewProduct}>
          <Stack spacing={2}>
            <Typography variant="h3">Create draft product</Typography>
            <Alert severity="info">
              Creation produces immutable version 1 in draft. Activate it only after reviewing every
              term.
            </Alert>
            <TextField
              label="Stable product key"
              required
              helperText="Uppercase letters, numbers, and underscores"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value.toUpperCase())}
            />
            <TermsFields value={newTerms} onChange={setNewTerms} />
            {createProduct.isError && (
              <Alert severity="error">
                The draft could not be created. Check the key, terms, and step-up session.
              </Alert>
            )}
            <Button type="submit" variant="contained" disabled={createProduct.isPending}>
              Create draft product
            </Button>
          </Stack>
        </Box>
      </SectionCard>
      <SectionCard variant="operational">
        <Stack spacing={2}>
          <DataNavigationToolbar
            searchLabel="Search products"
            searchPlaceholder="Product key or name"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            resultLabel={`${query.data?.total ?? 0} products`}
            loading={query.isFetching}
          >
            <TextField
              select
              label="Availability"
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive / draft</MenuItem>
            </TextField>
          </DataNavigationToolbar>
          {query.isLoading && <LinearProgress />}
          {query.isError && (
            <Alert severity="error">
              Products could not be loaded or commerce step-up is required.
            </Alert>
          )}
          <Stack divider={<Divider />}>
            {query.data?.products.map((product) => {
              const current =
                product.versions.find((version) => version.version === product.currentVersion) ??
                product.versions[0];
              return (
                <Stack
                  key={product.id}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ py: 2, alignItems: { md: 'center' } }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1}>
                      <Typography variant="h3">{current?.name ?? product.key}</Typography>
                      <Chip
                        size="small"
                        color={product.active ? 'success' : 'default'}
                        label={product.active ? 'Active' : 'Inactive'}
                      />
                    </Stack>
                    <Typography color="text.secondary">
                      {product.key} · v{current?.version ?? '—'} ·{' '}
                      {current ? `${current.currency} ${current.price}` : 'Draft terms required'}
                    </Typography>
                    <Typography variant="caption">
                      {current?.entitlementType.replaceAll('_', ' ')} ·{' '}
                      {current?.includedReviewCredits ?? 0} Review Credits
                    </Typography>
                  </Box>
                  <Button component={Link} to={`/admin/services/${product.id}`} variant="outlined">
                    Open product
                  </Button>
                </Stack>
              );
            })}
          </Stack>
          {query.data && (
            <DataPagination
              page={page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              hasMore={page * query.data.pageSize < query.data.total}
              onPageChange={setPage}
              loading={query.isFetching}
            />
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function AdminServiceDetailPage() {
  const { serviceProductId } = useParams();
  const queryClient = useQueryClient();
  const [newTerms, setNewTerms] = useState(emptyTerms);
  const query = useQuery({
    queryKey: ['admin-product', serviceProductId],
    queryFn: () =>
      apiRequest<{ product: Product }>(`/api/v1/admin/service-products/${serviceProductId}`),
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({
      operation,
      version,
    }: {
      operation: 'activate' | 'deactivate';
      version?: number;
    }) =>
      apiRequest(`/api/v1/admin/service-products/${serviceProductId}/${operation}`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': `${operation}-${serviceProductId}-${version ?? 'current'}-${Date.now()}`,
        },
        body: JSON.stringify(version ? { version } : {}),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-product', serviceProductId] }),
  });
  const createVersion = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/service-products/${serviceProductId}/versions`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `create-version-${serviceProductId}-${Date.now()}` },
        body: JSON.stringify(newTerms),
      }),
    onSuccess: () => {
      setNewTerms(emptyTerms);
      return queryClient.invalidateQueries({ queryKey: ['admin-product', serviceProductId] });
    },
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError)
    return (
      <Alert severity="error">Product detail is unavailable or commerce step-up is required.</Alert>
    );
  const product = query.data!.product;
  const latest = product.versions[0];
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Service product"
        title={latest?.name ?? product.key}
        description="Material term changes are new versions; historical purchases keep their original terms."
        actions={
          <Button component={Link} to="/admin/services">
            Back to products
          </Button>
        }
      />
      {action.isError && (
        <Alert severity="error">
          The action was denied or activation validation found blockers.
        </Alert>
      )}
      <SectionCard>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Chip
              label={product.active ? 'Active' : 'Inactive'}
              color={product.active ? 'success' : 'default'}
            />
            <Chip label={`Current v${product.currentVersion ?? 'none'}`} />
          </Stack>
          <Typography variant="h3">Identity & availability</Typography>
          <Typography>Key: {product.key}</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              disabled={!latest || action.isPending}
              variant="contained"
              onClick={() =>
                latest && action.mutate({ operation: 'activate', version: latest.version })
              }
            >
              Activate latest version
            </Button>
            <Button
              disabled={!product.active || action.isPending}
              color="warning"
              variant="outlined"
              onClick={() => action.mutate({ operation: 'deactivate' })}
            >
              Deactivate
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            createVersion.mutate();
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h3">Create next immutable version</Typography>
            <Typography color="text.secondary">
              Use a new version for every material price, entitlement, or eligibility change.
            </Typography>
            <TermsFields value={newTerms} onChange={setNewTerms} />
            {createVersion.isError && (
              <Alert severity="error">The new version could not be created.</Alert>
            )}
            <Button type="submit" variant="contained" disabled={createVersion.isPending}>
              Create next version
            </Button>
          </Stack>
        </Box>
      </SectionCard>
      <SectionCard>
        <Stack spacing={2} divider={<Divider />}>
          {product.versions.map((version) => (
            <Stack key={version.id} spacing={0.75}>
              <Stack direction="row" spacing={1}>
                <Typography variant="h3">Version {version.version}</Typography>
                <Chip size="small" label={version.status} />
              </Stack>
              <Typography>{version.description}</Typography>
              <Typography sx={{ fontWeight: 800 }}>
                {version.currency} {version.price} · {version.includedQuantity}{' '}
                {version.entitlementType.replaceAll('_', ' ')} unit(s) ·{' '}
                {version.includedReviewCredits} Review Credits
              </Typography>
              <Typography variant="caption">
                {version._count?.purchases ?? 0} historical purchases · created{' '}
                {new Date(version.createdAt).toLocaleString()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
