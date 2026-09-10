import { Alert, Box, Button, Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../auth/api';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { CollectionSurface } from '../components/common/CollectionSurface';
import {
  ArchetypeCanvas,
  FreshnessIndicator,
  MetricHero,
} from '../components/common/ProductFoundation';

export function AdminLandingPage() {
  type Section = {
    status: 'healthy' | 'degraded' | 'unavailable';
    href: string;
    reason?: string;
    pending?: number;
    failed?: number;
    disputes?: number;
    queued?: number;
    conflicts?: number;
    enabled?: number;
    unhealthy?: number;
    recent?: number;
    active?: number;
    inactive?: number;
    pendingOutbox?: number;
    failedOutbox?: number;
  };
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () =>
      apiRequest<{ asOf: string; sections: Record<string, Section> }>('/api/v1/admin/dashboard'),
    refetchInterval: 30_000,
  });
  type DashboardCard = {
    title: string;
    section: Section | undefined;
    valueKey: keyof Section;
    description: string;
  };
  const cards: DashboardCard[] = query.data
    ? [
        {
          title: 'Payments',
          section: query.data.sections.commerce,
          valueKey: 'pending',
          description: 'Pending payment operations',
        },
        {
          title: 'AI runtime',
          section: query.data.sections.ai,
          valueKey: 'queued',
          description: 'Queued or active AI jobs',
        },
        {
          title: 'Catalog',
          section: query.data.sections.catalog,
          valueKey: 'conflicts',
          description: 'Catalog conflicts requiring review',
        },
        {
          title: 'Integrations',
          section: query.data.sections.integrations,
          valueKey: 'unhealthy',
          description: 'Enabled integrations degraded',
        },
        {
          title: 'Security',
          section: query.data.sections.security,
          valueKey: 'recent',
          description: 'Warnings in the last 24 hours',
        },
        {
          title: 'Products',
          section: query.data.sections.products,
          valueKey: 'active',
          description: 'Active service products',
        },
        {
          title: 'Platform',
          section: query.data.sections.platform,
          valueKey: 'failedOutbox',
          description: 'Failed durable outbox events',
        },
        {
          title: 'Scheduled jobs',
          section: query.data.sections.scheduledJobs,
          valueKey: 'failed',
          description: 'Scheduled-job operations',
        },
      ]
    : [];
  const displayedCards: DashboardCard[] = query.isLoading
    ? Array.from({ length: 8 }, (_, index) => ({
        title: `Loading ${index + 1}`,
        section: undefined,
        valueKey: 'status',
        description: 'Loading operational status',
      }))
    : cards;
  const attention = cards.filter(({ section, valueKey }) => {
    const value = section?.[valueKey];
    return section?.status !== 'healthy' || (typeof value === 'number' && value > 0);
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Admin"
        title="Operations overview"
        description="Monitor canonical platform modules and open the owning operational surface."
      />
      {query.isError ? (
        <Alert severity="error">
          Operational status could not be loaded. Existing modules remain available from navigation.
        </Alert>
      ) : (
        <Stack spacing={1}>
          <Alert severity={attention.length ? 'warning' : 'success'}>
            {attention.length
              ? `${attention.length} identity, security, or commerce areas have current work or degraded signals. Open the owning module to investigate.`
              : 'No current monitored exception is reported. Configuration changes remain in their owning modules.'}
          </Alert>
          <Typography variant="caption" color="text.secondary">
            Current snapshot · API operational summaries · as of{' '}
            {query.data?.asOf ? new Date(query.data.asOf).toLocaleString() : 'loading'}
          </Typography>
        </Stack>
      )}
      {attention.length > 0 && (
        <SectionCard variant="elevated">
          <Stack spacing={1.25}>
            <Typography variant="overline">Immediate attention</Typography>
            <Typography variant="h2">Review current exceptions</Typography>
            {attention.slice(0, 4).map(({ title, section, valueKey, description }) => (
              <Stack
                key={title}
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ gap: 1, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{title} attention</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {String(section?.[valueKey] ?? '—')} · {description}
                  </Typography>
                </Box>
                {section?.href && (
                  <Button component={Link} to={section.href}>
                    Review {title.toLowerCase()}
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      )}
      <Grid container spacing={2}>
        {displayedCards.map(({ title, section, valueKey, description }, index) => {
          const value = section && valueKey ? section[valueKey] : undefined;
          return (
            <Grid key={title ?? index} size={{ xs: 12, sm: 6, lg: 3 }}>
              <SectionCard variant="interactive" sx={{ height: '100%' }}>
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <MetricCard
                    label={title}
                    value={value ?? '—'}
                    supportingText={description}
                    loading={query.isLoading}
                  />
                  {query.data?.asOf && (
                    <Typography variant="caption" color="text.secondary">
                      Current snapshot · {new Date(query.data.asOf).toLocaleTimeString()}
                    </Typography>
                  )}
                  {section?.status !== 'healthy' && !query.isLoading && (
                    <Alert severity={section?.status === 'degraded' ? 'warning' : 'info'}>
                      {section?.reason ?? 'This module is partially degraded.'}
                    </Alert>
                  )}
                  {section?.href && (
                    <Button
                      component={Link}
                      to={section.href}
                      variant="outlined"
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Open module
                    </Button>
                  )}
                </Stack>
              </SectionCard>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}

export function StaffAccountPage() {
  const { user } = useAuth();
  const base = user?.role === 'ADMIN' ? '/admin' : '/crm';
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={user?.role === 'ADMIN' ? 'Admin account' : 'Consultant account'}
        title="Account"
        description="Your authenticated staff identity and security status."
      />
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Signed in as
            </Typography>
            <Typography sx={{ fontWeight: 800 }}>{user?.email}</Typography>
          </Box>
          <Chip
            label={user?.staffMfaVerified ? 'MFA verified' : 'MFA required'}
            color={user?.staffMfaVerified ? 'success' : 'warning'}
            sx={{ alignSelf: 'flex-start' }}
          />
          <Button
            component={Link}
            to={`${base}/account/security`}
            variant="contained"
            sx={{ alignSelf: 'flex-start' }}
          >
            Security & sessions
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

export function SystemHealthPage() {
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () =>
      apiRequest<{
        asOf: string;
        sections: Record<
          string,
          {
            status: string;
            reason?: string;
            href?: string;
            pendingOutbox?: number;
            failedOutbox?: number;
            pending?: number;
            failed?: number;
            queued?: number;
            unhealthy?: number;
            conflicts?: number;
          }
        >;
      }>('/api/v1/admin/dashboard'),
    refetchInterval: 30_000,
  });
  const platform = query.data?.sections.platform;
  const safeMetrics = (section: NonNullable<typeof platform>) =>
    Object.entries(section).filter(
      ([key, value]) => !['status', 'reason', 'href'].includes(key) && typeof value === 'number',
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Utilities"
        title="System health"
        description="Safe operational signals for the durable platform runtime. Sensitive payloads and credentials are never displayed."
      />
      {query.isError ? (
        <Alert
          severity="error"
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        >
          Health signals could not be loaded.
        </Alert>
      ) : (
        <ArchetypeCanvas archetype="observability-cockpit" role="admin">
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' } }}
            >
              <Box sx={{ flex: 1 }}>
                <MetricHero
                  label="Durable delivery backlog"
                  value={platform?.pendingOutbox ?? '—'}
                  explanation="Events waiting for a worker claim in the current canonical snapshot."
                  source="Admin operational summary endpoint"
                />
              </Box>
              <FreshnessIndicator
                state={platform?.status === 'healthy' ? 'confirmed' : 'stale'}
                at={query.data?.asOf}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <MetricCard
                label="Pending events"
                value={platform?.pendingOutbox ?? '—'}
                supportingText="Waiting for a worker claim"
                loading={query.isLoading}
              />
              <MetricCard
                label="Failed events"
                value={platform?.failedOutbox ?? '—'}
                supportingText="Require operational review"
                loading={query.isLoading}
              />
            </Stack>
            <Alert severity={platform?.status === 'healthy' ? 'success' : 'warning'}>
              {platform?.status === 'healthy'
                ? 'Core operational checks are healthy.'
                : (platform?.reason ?? 'One or more safe health checks are degraded.')}
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Last checked {query.data?.asOf ? new Date(query.data.asOf).toLocaleString() : '—'}
            </Typography>
          </Stack>
        </ArchetypeCanvas>
      )}
      {!query.isError && (
        <CollectionSurface
          title="Platform dependency checks"
          mode="grid"
          busy={query.isFetching}
          empty={!query.isLoading && !Object.keys(query.data?.sections ?? {}).length}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {Object.entries(query.data?.sections ?? {})
              .filter(([key]) => key !== 'platform')
              .map(([key, section]) => (
                <SectionCard key={key}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Typography variant="h4">
                        {key.replace(/([a-z])([A-Z])/g, '$1 $2')}
                      </Typography>
                      <Chip
                        size="small"
                        color={section.status === 'healthy' ? 'success' : 'warning'}
                        label={
                          section.status === 'healthy'
                            ? 'Healthy'
                            : section.status === 'degraded'
                              ? 'Degraded'
                              : 'Unavailable'
                        }
                      />
                    </Stack>
                    {section.reason && (
                      <Typography color="text.secondary">{section.reason}</Typography>
                    )}
                    {safeMetrics(section).map(([metric, value]) => (
                      <Typography key={metric} variant="body2">
                        {metric.replace(/([a-z])([A-Z])/g, '$1 $2')}:{' '}
                        <strong>{String(value)}</strong>
                      </Typography>
                    ))}
                    {section.href && (
                      <Button component={Link} to={section.href} sx={{ alignSelf: 'flex-start' }}>
                        Open owning module
                      </Button>
                    )}
                  </Stack>
                </SectionCard>
              ))}
          </Box>
        </CollectionSurface>
      )}
    </Stack>
  );
}

export function FoundationPage({ title, description }: { title: string; description: string }) {
  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Unavailable" title={title} description={description} />
      <SectionCard>
        <Stack spacing={1.5}>
          <Chip label="Not available" color="info" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="h3">This destination is unavailable</Typography>
          <Typography color="text.secondary">
            The requested destination does not exist or is outside your authorized workspace. Use
            the navigation to continue.
          </Typography>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
