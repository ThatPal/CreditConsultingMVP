import BusinessRounded from '@mui/icons-material/BusinessRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { JourneySummary, type JourneyProjection } from './JourneyPages';
import { ClientServicesSummary, type CommerceData } from './ServicesPage';

type DirectoryClient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  timezone: string;
  status: string;
  user: { email: string };
  _count: { businesses: number; financialRelationships: number };
};
type DirectoryResponse = {
  clients: DirectoryClient[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ search, page: String(page), pageSize: '20' });
  const query = useQuery({
    queryKey: ['client-directory', search, page],
    queryFn: () => apiRequest<DirectoryResponse>(`/api/v1/consultant/client-context?${params}`),
    placeholderData: (previous) => previous,
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Relationships"
        title="Clients"
        description="Search the people you are currently authorized to support and open their canonical relationship context."
      />
      <SectionCard variant="operational">
        <Stack spacing={2}>
          <DataNavigationToolbar
            searchLabel="Search clients"
            searchPlaceholder="Name or email"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            resultLabel={`${query.data?.total ?? 0} authorized clients`}
            loading={query.isFetching}
          />
          {query.isLoading && (
            <Stack sx={{ alignItems: 'center', py: 5 }}>
              <CircularProgress aria-label="Loading client directory" />
            </Stack>
          )}
          {query.isError && (
            <Alert severity="error" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
              The client directory could not be loaded.
            </Alert>
          )}
          {query.data?.clients.length === 0 && (
            <Alert severity="info">No authorized clients match this search.</Alert>
          )}
          <Stack divider={<Divider />}>
            {query.data?.clients.map((client) => (
              <Stack
                key={client.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ py: 2, alignItems: { sm: 'center' } }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4">
                    {client.firstName} {client.lastName}
                  </Typography>
                  <Typography color="text.secondary">{client.user.email}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip size="small" label={`${client._count.businesses} businesses`} />
                    <Chip
                      size="small"
                      label={`${client._count.financialRelationships} relationships`}
                    />
                  </Stack>
                </Box>
                <Button
                  component={Link}
                  to={`/crm/clients/${client.id}`}
                  endIcon={<ChevronRightRounded />}
                >
                  Open Client 360
                </Button>
              </Stack>
            ))}
          </Stack>
          {query.data && (
            <DataPagination
              page={page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              hasMore={query.data.hasMore}
              onPageChange={setPage}
              loading={query.isFetching}
            />
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

type ClientDetail = DirectoryClient & {
  createdAt: string;
  assignedConsultant: { id: string; name: string | null; email: string } | null;
  businesses: Array<{
    id: string;
    legalName: string;
    displayName: string | null;
    entityType: string | null;
    industry: string | null;
    status: string;
  }>;
  financialRelationships: Array<{
    id: string;
    institutionName: string;
    relationshipType: string;
    approximateTenure: string | null;
    status: string;
    clientBusiness: { id: string; displayName: string | null; legalName: string } | null;
  }>;
};

export function Client360Page() {
  const { clientId } = useParams();
  const query = useQuery({
    queryKey: ['client-360', clientId],
    queryFn: () =>
      apiRequest<{ client: ClientDetail }>(`/api/v1/consultant/client-context/${clientId}`),
    retry: false,
  });
  const journeyQuery = useQuery({
    queryKey: ['consultant-client-journey', clientId],
    queryFn: () => apiRequest<JourneyProjection>(`/api/v1/consultant/clients/${clientId}/journey`),
    enabled: Boolean(clientId),
    retry: false,
  });
  const servicesQuery = useQuery({
    queryKey: ['consultant-client-services', clientId],
    queryFn: () => apiRequest<CommerceData>(`/api/v1/consultant/clients/${clientId}/services`),
    enabled: Boolean(clientId),
    retry: false,
  });
  if (query.isLoading)
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading Client 360" />
      </Stack>
    );
  if (query.isError)
    return (
      <Stack spacing={2}>
        <Alert severity="error">This client is unavailable or you no longer have access.</Alert>
        <Button component={Link} to="/crm/clients" sx={{ alignSelf: 'flex-start' }}>
          Back to clients
        </Button>
      </Stack>
    );
  const client = query.data!.client;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Client 360"
        title={`${client.firstName} ${client.lastName}`}
        description="Canonical identity, business, and financial-relationship context for authorized work."
        actions={
          <Button component={Link} to="/crm/clients" variant="outlined">
            Back to clients
          </Button>
        }
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard>
            <Stack spacing={1}>
              <Typography variant="h3">Contact context</Typography>
              <Typography>{client.user.email}</Typography>
              <Typography color="text.secondary">{client.phone ?? 'No phone provided'}</Typography>
              <Typography color="text.secondary">Timezone: {client.timezone}</Typography>
              <Chip label={client.status} color="success" sx={{ alignSelf: 'flex-start' }} />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard>
            <Stack spacing={1}>
              <Typography variant="h3">Access context</Typography>
              <Typography>
                {client.assignedConsultant
                  ? `Primary consultant: ${client.assignedConsultant.name ?? client.assignedConsultant.email}`
                  : 'Access is provided by an active governed grant.'}
              </Typography>
              <Typography color="text.secondary">
                Only currently effective assignments and grants permit this view.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
      {journeyQuery.isLoading && <CircularProgress aria-label="Loading client journey" />}
      {journeyQuery.isError && (
        <Alert severity="warning">Journey context is unavailable or access changed.</Alert>
      )}
      {journeyQuery.data?.journey && <JourneySummary data={journeyQuery.data} staff />}
      {servicesQuery.data?.balance && <ClientServicesSummary data={servicesQuery.data} />}
      <SectionCard>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <BusinessRounded color="primary" />
            <Typography variant="h3">Businesses</Typography>
          </Stack>
          {client.businesses.length === 0 ? (
            <Alert severity="info">This client currently has a personal-only profile.</Alert>
          ) : (
            client.businesses.map((item) => (
              <Box key={item.id}>
                <Typography sx={{ fontWeight: 700 }}>
                  {item.displayName ?? item.legalName}
                </Typography>
                <Typography color="text.secondary">
                  {[item.entityType, item.industry, item.status].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            ))
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AccountBalanceRounded color="primary" />
            <Typography variant="h3">Financial relationships</Typography>
          </Stack>
          <Alert severity="info">
            High-level relationship context only. Account numbers, balances, and online-banking
            credentials are never stored here.
          </Alert>
          {client.financialRelationships.length === 0 ? (
            <Typography color="text.secondary">No financial relationships recorded.</Typography>
          ) : (
            client.financialRelationships.map((item) => (
              <Box key={item.id}>
                <Typography sx={{ fontWeight: 700 }}>{item.institutionName}</Typography>
                <Typography color="text.secondary">
                  {[
                    item.relationshipType.replaceAll('_', ' '),
                    item.approximateTenure,
                    item.clientBusiness?.displayName ?? item.clientBusiness?.legalName,
                    item.status,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            ))
          )}
        </Stack>
      </SectionCard>
      <Alert severity="info">
        Reviews, documents, services, and other future Client 360 modules remain in their owning
        workflows; no inferred metrics are shown here.
      </Alert>
    </Stack>
  );
}
