import { Alert, Box, Button, Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export function AdminLandingPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Admin"
        title="Administration"
        description="Manage governed services, payments, provider health, and account security."
      />
      <Alert severity="info">
        Access is capability-gated. If an expected module is absent, confirm the account’s assigned
        permissions and current MFA verification.
      </Alert>
      <SectionCard>
        <Typography variant="h3">Platform status</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Use Services to govern product terms, Payments to review financial operations, and
          Integrations to verify each configured gateway.
        </Typography>
      </SectionCard>
      <Grid container spacing={2}>
        {(
          [
            [
              'Services & products',
              'Govern product terms, versions, availability, and entitlements.',
              '/admin/services',
            ],
            [
              'Payments',
              'Search payment operations and review refunds, disputes, and reconciliation.',
              '/admin/payments',
            ],
            [
              'Gateway integrations',
              'Verify PayPal, Stripe, and Bank of America provider health.',
              '/admin/integrations/paypal',
            ],
          ] as const
        ).map(([title, description, path]) => (
          <Grid key={path} size={{ xs: 12, md: 4 }}>
            <SectionCard variant="interactive" sx={{ height: '100%' }}>
              <Stack spacing={1.5} sx={{ height: '100%' }}>
                <Typography variant="h3">{title}</Typography>
                <Typography color="text.secondary" sx={{ flex: 1 }}>
                  {description}
                </Typography>
                <Button
                  component={Link}
                  to={path}
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Open
                </Button>
              </Stack>
            </SectionCard>
          </Grid>
        ))}
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
