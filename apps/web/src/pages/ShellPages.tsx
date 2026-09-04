import { Alert, Box, Button, Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../auth/api';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

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
        { title: 'Payments', section: query.data.sections.commerce, valueKey: 'pending', description: 'Pending payment operations' },
        { title: 'AI runtime', section: query.data.sections.ai, valueKey: 'queued', description: 'Queued or active AI jobs' },
        { title: 'Catalog', section: query.data.sections.catalog, valueKey: 'conflicts', description: 'Catalog conflicts requiring review' },
        { title: 'Integrations', section: query.data.sections.integrations, valueKey: 'unhealthy', description: 'Enabled integrations degraded' },
        { title: 'Security', section: query.data.sections.security, valueKey: 'recent', description: 'Warnings in the last 24 hours' },
        { title: 'Products', section: query.data.sections.products, valueKey: 'active', description: 'Active service products' },
        { title: 'Platform', section: query.data.sections.platform, valueKey: 'failedOutbox', description: 'Failed durable outbox events' },
        { title: 'Scheduled jobs', section: query.data.sections.scheduledJobs, valueKey: 'failed', description: 'Scheduled-job operations' },
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
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Admin"
        title="Operations overview"
        description="Monitor canonical platform modules and open the owning operational surface."
      />
      {query.isError ? (
        <Alert severity="error">Operational status could not be loaded. Existing modules remain available from navigation.</Alert>
      ) : (
        <Alert severity="info">
          This dashboard is monitoring only. Work and configuration changes remain in their owning modules.
        </Alert>
      )}
      <Grid container spacing={2}>
        {displayedCards.map(({ title, section, valueKey, description }, index) => {
          const value = section && valueKey ? section[valueKey] : undefined;
          return <Grid key={title ?? index} size={{ xs: 12, sm: 6, lg: 3 }}>
            <SectionCard variant="interactive" sx={{ height: '100%' }}>
              <Stack spacing={1.5} sx={{ height: '100%' }}>
                <MetricCard label={title} value={value ?? '—'} supportingText={description} loading={query.isLoading} />
                {section?.status !== 'healthy' && !query.isLoading && (
                  <Alert severity={section?.status === 'degraded' ? 'warning' : 'info'}>{section?.reason ?? 'This module is partially degraded.'}</Alert>
                )}
                {section?.href && <Button component={Link} to={section.href} variant="outlined" sx={{ alignSelf: 'flex-start' }}>Open module</Button>}
              </Stack>
            </SectionCard>
          </Grid>;
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
        eyebrow={user?.role === 'ADMIN' ? 'Admin account' : 'CRM-28'}
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

export function FoundationPage({ title, description }: { title: string; description: string }) {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Coming in a future product phase"
        title={title}
        description={description}
      />
      <SectionCard>
        <Stack spacing={1.5}>
          <Chip label="Future owner" color="info" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="h3">No placeholder activity is shown</Typography>
          <Typography color="text.secondary">
            This area will become available when its complete, authoritative workflow is ready. Use
            the navigation to continue with currently available tools.
          </Typography>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
