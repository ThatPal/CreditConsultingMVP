import { Alert, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import type { CurrentUser } from '../../auth/api';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { AppShell } from '../../layouts/AppShell';
import { navigationFor, type ShellKind } from '../../layouts/navigation';

const roleFor = (shell: ShellKind): CurrentUser['role'] =>
  shell === 'client' ? 'CLIENT' : shell === 'consultant' ? 'CONSULTANT' : 'ADMIN';

export function ShellEvidencePage() {
  const requested = useParams().role;
  const shell: ShellKind =
    requested === 'consultant' || requested === 'admin' ? requested : 'client';
  const user: CurrentUser = {
    userId: 'evidence-only',
    email: `${shell}@credit.local`,
    role: roleFor(shell),
    status: 'ACTIVE',
    clientId: shell === 'client' ? 'evidence-client' : null,
    staffMfaEnabled: shell !== 'client',
    staffMfaVerified: true,
    stepUpVerified: true,
    capabilities: shell === 'consultant' ? ['client.read', 'support.manage'] : [],
  };
  const title =
    shell === 'client'
      ? 'Your credit workspace'
      : shell === 'consultant'
        ? 'Consultant command center'
        : 'Administration foundation';
  return (
    <AppShell role={shell} items={navigationFor(user, shell)}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Sprint 2.3 evidence"
          title={title}
          description="Responsive, role-specific application shell proof."
        />
        <Alert severity="info">
          This development-only route demonstrates shell composition; authenticated production
          routes remain server-guarded.
        </Alert>
        <SectionCard>
          <Typography variant="h3">Secure workspace ready</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Account and security entry points are available. Future modules appear only after their
            owning sprint and capability policy are accepted.
          </Typography>
        </SectionCard>
      </Stack>
    </AppShell>
  );
}
