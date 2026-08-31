import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

export function AdminLandingPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Admin"
        title="Administration foundation"
        description="A secure operations shell for capability-gated administration modules."
      />
      <Alert severity="info">
        Operational modules will appear here only when their owning sprint and capability policy are
        accepted.
      </Alert>
      <SectionCard>
        <Typography variant="h3">Platform status</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Your Admin workspace is active. Consultant advisory tools are intentionally not included.
        </Typography>
      </SectionCard>
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
      <PageHeader eyebrow="Foundation" title={title} description={description} />
      <SectionCard>
        <Typography color="text.secondary">
          This mounting point is ready. Its business workflow remains owned by a later sprint.
        </Typography>
      </SectionCard>
    </Stack>
  );
}
