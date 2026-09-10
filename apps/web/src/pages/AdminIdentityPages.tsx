import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { DataNavigationToolbar, DataPagination } from '../components/common/DataNavigation';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { GovernedActionDialog, RecoveryState } from '../components/common/InteractionPatterns';
import { CollectionSurface } from '../components/common/CollectionSurface';
import { humanizeCode } from '../components/common/labels';

type UserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  updatedAt: string;
  _count: { betterAuthSessions: number; accessGrants: number; staffAssignments: number };
};
type UserDetail = UserSummary & {
  capabilities: string[];
  betterAuthSessions: Array<{
    id: string;
    updatedAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  accessGrants: Array<{
    id: string;
    clientId: string;
    scope: string;
    startsAt: string;
    expiresAt: string;
    revokedAt: string | null;
    reason: string;
  }>;
  staffAssignments: Array<{
    id: string;
    clientId: string;
    activatedAt: string;
    deactivatedAt: string | null;
  }>;
};

const command = (url: string, method: string, body?: unknown) =>
  apiRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1),
    search = params.get('search') ?? '',
    role = params.get('role') ?? '',
    status = params.get('status') ?? '';
  const query = useQuery({
    queryKey: ['admin-users', page, search, role, status],
    queryFn: () =>
      apiRequest<{ users: UserSummary[]; total: number; hasMore: boolean }>(
        `/api/v1/admin/users?page=${page}&pageSize=20&search=${encodeURIComponent(search)}${role ? `&role=${role}` : ''}${status ? `&status=${status}` : ''}`,
      ),
  });
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Users & staff"
        description="Govern roles, sessions, MFA, assignments, and temporary access without conferring consultant authority to Admin."
      />
      <DataNavigationToolbar
        searchLabel="Search users"
        searchPlaceholder="Name or email"
        searchValue={search}
        onSearchChange={(value: string) => set('search', value)}
        resultLabel={`${query.data?.total ?? 0} users`}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            select
            size="small"
            label="Role"
            value={role}
            onChange={(e) => set('role', e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All roles</MenuItem>
            <MenuItem value="CLIENT">Client</MenuItem>
            <MenuItem value="CONSULTANT">Consultant</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => set('status', e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="DISABLED">Disabled</MenuItem>
            <MenuItem value="INVITED">Invited</MenuItem>
          </TextField>
        </Stack>
      </DataNavigationToolbar>
      {query.isError && <Alert severity="error">Users could not be loaded.</Alert>}
      <CollectionSurface
        title="Identity directory"
        mode="bounded"
        busy={query.isFetching}
        empty={!query.isLoading && !query.data?.users.length}
        footer={
          <DataPagination
            page={page}
            pageSize={20}
            total={query.data?.total ?? 0}
            hasMore={Boolean(query.data?.hasMore)}
            onPageChange={(next) => set('page', String(next))}
          />
        }
      >
        <Stack divider={<Divider flexItem />}>
          {query.data?.users.map((user) => (
            <Box key={user.id} data-collection-item tabIndex={0} sx={{ py: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                sx={{ justifyContent: 'space-between', gap: 1 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{user.name || user.email}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                  <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={humanizeCode(user.role)} />
                    <Chip size="small" label={humanizeCode(user.status)} />
                    <Chip size="small" label={`${user._count.betterAuthSessions} sessions`} />
                    <Chip
                      size="small"
                      label={user.twoFactorEnabled ? 'MFA enabled' : 'MFA not enrolled'}
                    />
                  </Stack>
                </Box>
                <Button component={Link} to={`/admin/users/${user.id}`}>
                  Review
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CollectionSurface>
    </Stack>
  );
}

export function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [pendingAction, setPendingAction] = useState<null | {
    kind: 'role' | 'mfa' | 'session' | 'assignment';
    id?: string;
  }>(null);
  const query = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => apiRequest<{ user: UserDetail }>(`/api/v1/admin/users/${userId}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-user', userId] });
  const mutation = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) =>
      command(url, method, body),
    onSuccess: () => {
      setPendingAction(null);
      return refresh();
    },
  });
  const user = query.data?.user;
  const nextRole = role || user?.role || '';
  const current = new Set(user?.capabilities ?? []);
  const preview = useMemo(
    () =>
      nextRole === user?.role
        ? []
        : [
            'Role capabilities will change after confirmation; all existing sessions will be revoked.',
          ],
    [nextRole, user?.role],
  );
  if (query.isLoading) return <Typography>Loading identity…</Typography>;
  if (query.isError)
    return (
      <RecoveryState
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/admin/users"
        backLabel="Back to users"
      />
    );
  if (!user) return <Alert severity="info">This user is not available.</Alert>;
  const confirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'role')
      mutation.mutate({
        url: `/api/v1/admin/users/${user.id}/role`,
        method: 'PATCH',
        body: { role: nextRole, expectedUpdatedAt: user.updatedAt },
      });
    if (pendingAction.kind === 'mfa')
      mutation.mutate({ url: `/api/v1/admin/users/${user.id}/mfa-reset`, method: 'POST' });
    if (pendingAction.kind === 'session' && pendingAction.id)
      mutation.mutate({
        url: `/api/v1/admin/users/${user.id}/sessions/${pendingAction.id}`,
        method: 'DELETE',
      });
    if (pendingAction.kind === 'assignment' && pendingAction.id)
      mutation.mutate({
        url: `/api/v1/admin/assignments/${pendingAction.id}/deactivate`,
        method: 'POST',
      });
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        title={user.name || user.email}
        description={user.email}
        actions={
          <Button component={Link} to="/admin/users">
            Back to users
          </Button>
        }
      />
      {mutation.isError && (
        <Alert severity="error">
          The protected operation failed. Refresh and verify step-up MFA.
        </Alert>
      )}
      <SectionCard>
        <Typography variant="h6">Role & capability impact</Typography>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {[...current].map((c) => (
              <Chip key={c} size="small" label={c} />
            ))}
          </Stack>
          <TextField
            select
            label="Staff role"
            value={nextRole}
            onChange={(e) => setRole(e.target.value)}
          >
            <MenuItem value="CONSULTANT">Consultant</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
          </TextField>
          {preview.map((note) => (
            <Alert key={note} severity="warning">
              {note}
            </Alert>
          ))}
          <Button
            disabled={nextRole === user.role || mutation.isPending}
            onClick={() => setPendingAction({ kind: 'role' })}
          >
            Confirm role change
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">MFA & sessions</Typography>
        <Stack spacing={2}>
          <Alert severity={user.twoFactorEnabled ? 'success' : 'info'}>
            {user.twoFactorEnabled ? 'MFA enrolled' : 'MFA enrollment required for staff access'}
          </Alert>
          <Button
            color="warning"
            variant="outlined"
            onClick={() => setPendingAction({ kind: 'mfa' })}
          >
            Reset staff MFA
          </Button>
          <Divider />
          {user.betterAuthSessions.map((s) => (
            <Stack
              key={s.id}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ justifyContent: 'space-between', gap: 1 }}
            >
              <Box>
                <Typography variant="body2">
                  Last active {new Date(s.updatedAt).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Expires {new Date(s.expiresAt).toLocaleString()} ·{' '}
                  {s.ipAddress || 'IP unavailable'}
                </Typography>
              </Box>
              <Button
                color="warning"
                onClick={() => setPendingAction({ kind: 'session', id: s.id })}
              >
                Revoke
              </Button>
            </Stack>
          ))}
          {!user.betterAuthSessions.length && (
            <Typography color="text.secondary">No active sessions.</Typography>
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Client assignments</Typography>
        <Stack divider={<Divider flexItem />}>
          {user.staffAssignments.map((a) => (
            <Stack sx={{ py: 1, justifyContent: 'space-between' }} key={a.id} direction="row">
              <Typography variant="body2">
                Client {a.clientId} · {a.deactivatedAt ? 'Inactive' : 'Active'}
              </Typography>
              {!a.deactivatedAt && (
                <Button onClick={() => setPendingAction({ kind: 'assignment', id: a.id })}>
                  Deactivate
                </Button>
              )}
            </Stack>
          ))}
          {!user.staffAssignments.length && (
            <Typography color="text.secondary">No client assignments.</Typography>
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Temporary access</Typography>
        <Stack>
          {user.accessGrants.map((g) => (
            <Typography key={g.id} variant="body2">
              {g.scope} · client {g.clientId} ·{' '}
              {g.revokedAt ? 'Revoked' : `expires ${new Date(g.expiresAt).toLocaleString()}`}
            </Typography>
          ))}
          {!user.accessGrants.length && (
            <Typography color="text.secondary">No access grants.</Typography>
          )}
        </Stack>
      </SectionCard>
      <GovernedActionDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.kind === 'role'
            ? 'Change staff role'
            : pendingAction?.kind === 'mfa'
              ? 'Reset staff MFA'
              : pendingAction?.kind === 'session'
                ? 'Revoke session'
                : 'Deactivate client assignment'
        }
        effect={
          pendingAction?.kind === 'role'
            ? `Change role from ${user.role} to ${nextRole} and revoke all active sessions. Role membership remains distinct from client-scoped grants.`
            : pendingAction?.kind === 'mfa'
              ? 'Remove the enrolled second factor and revoke every active session. The staff member must enroll again.'
              : pendingAction?.kind === 'session'
                ? 'Revoke this session immediately without changing other sessions or role membership.'
                : 'End this client assignment without changing immutable assignment history or granting Admin professional authority.'
        }
        context={user.email}
        warning
        pending={mutation.isPending}
        preview={{
          current:
            pendingAction?.kind === 'role'
              ? humanizeCode(user.role)
              : pendingAction?.kind === 'mfa'
                ? user.twoFactorEnabled
                  ? 'MFA enrolled'
                  : 'MFA not enrolled'
                : 'Active',
          proposed:
            pendingAction?.kind === 'role'
              ? humanizeCode(nextRole)
              : pendingAction?.kind === 'mfa'
                ? 'MFA enrollment required'
                : 'Revoked',
          scope:
            pendingAction?.kind === 'role' || pendingAction?.kind === 'mfa'
              ? `${user.email} and all active sessions`
              : `${user.email}; selected record only`,
          timing: 'Immediately after successful MFA-authorized confirmation',
          reversibility:
            pendingAction?.kind === 'session'
              ? 'The session cannot be restored; the user may sign in again.'
              : 'A new authorized action is required to restore access.',
          audit: 'The actor, target, effect, time, and outcome are recorded in immutable history.',
        }}
        {...(mutation.isError ? { error: mutation.error.message } : {})}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </Stack>
  );
}

export function AdminAccessGrantsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [selectedGrant, setSelectedGrant] = useState<{ id: string; label: string } | null>(null);
  const [granteeId, setGranteeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [scope, setScope] = useState('READ');
  const [capability, setCapability] = useState('client.read');
  const [durationDays, setDurationDays] = useState(7);
  const [grantReason, setGrantReason] = useState('');
  const [confirmCreate, setConfirmCreate] = useState(false);
  const options = useQuery({
    queryKey: ['admin-grant-options'],
    queryFn: () =>
      apiRequest<{
        staff: Array<{ id: string; name: string | null; email: string; role: string }>;
        clients: Array<{
          id: string;
          firstName: string;
          lastName: string;
          status: string;
          user: { email: string };
        }>;
      }>('/api/v1/admin/access-grant-options?limit=50'),
  });
  const q = useQuery({
    queryKey: ['admin-grants', page],
    queryFn: () =>
      apiRequest<{
        grants: Array<{
          id: string;
          scope: string;
          reason: string;
          expiresAt: string;
          revokedAt: string | null;
          grantee: { name: string | null; email: string };
          client: { firstName: string; lastName: string };
        }>;
        total: number;
        hasMore: boolean;
      }>(`/api/v1/admin/access-grants?page=${page}&pageSize=20`),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => command(`/api/v1/admin/access-grants/${id}/revoke`, 'POST'),
    onSuccess: () => {
      setSelectedGrant(null);
      return qc.invalidateQueries({ queryKey: ['admin-grants'] });
    },
  });
  const create = useMutation({
    mutationFn: () => {
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
      return command('/api/v1/admin/access-grants', 'POST', {
        granteeId,
        clientId,
        scope,
        capabilities: [capability],
        reason: grantReason,
        reference: 'APC Wave 5 governed Admin grant editor',
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    },
    onSuccess: () => {
      setConfirmCreate(false);
      setGranteeId('');
      setClientId('');
      setGrantReason('');
      return qc.invalidateQueries({ queryKey: ['admin-grants'] });
    },
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Scoped access grants"
        description="Preview, issue, review, and immediately revoke time-bounded client access."
      />
      {(q.isError || options.isError) && (
        <RecoveryState
          error={q.error ?? options.error}
          onRetry={() => {
            void q.refetch();
            void options.refetch();
          }}
        />
      )}
      <SectionCard>
        <Stack spacing={2}>
          <Typography variant="h3">Create time-bounded access</Typography>
          <Alert severity="info">
            This creates a least-privilege client grant. It does not change role membership, staff
            assignment, or professional authority.
          </Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Staff member"
              value={granteeId}
              onChange={(event) => setGranteeId(event.target.value)}
            >
              {options.data?.staff.map((staff) => (
                <MenuItem key={staff.id} value={staff.id}>
                  {staff.name || staff.email} · {staff.role === 'ADMIN' ? 'Admin' : 'Consultant'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {options.data?.clients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} · {client.user.email}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Grant scope"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <MenuItem value="READ">Read only</MenuItem>
              <MenuItem value="SUPPORT_ONLY">Support only</MenuItem>
              <MenuItem value="CONSULTANT_WORK">Consultant work</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              label="Capability"
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            >
              <MenuItem value="client.read">Read client context</MenuItem>
              <MenuItem value="review.read">Read Credit Review</MenuItem>
              <MenuItem value="support.read">Read Support</MenuItem>
              <MenuItem value="support.manage">Manage Support</MenuItem>
              <MenuItem value="document.read">Read documents</MenuItem>
              <MenuItem value="strategy.read">Read Strategy</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              label="Duration"
              value={durationDays}
              onChange={(event) => setDurationDays(Number(event.target.value))}
            >
              <MenuItem value={1}>1 day</MenuItem>
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
            </TextField>
          </Stack>
          <TextField
            label="Business purpose"
            value={grantReason}
            onChange={(event) => setGrantReason(event.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {create.isError && <RecoveryState error={create.error} />}
          <Button
            variant="contained"
            sx={{ alignSelf: 'flex-start' }}
            disabled={!granteeId || !clientId || grantReason.trim().length < 4 || create.isPending}
            onClick={() => setConfirmCreate(true)}
          >
            Review access grant
          </Button>
        </Stack>
      </SectionCard>
      <CollectionSurface
        title="Grant history"
        mode="bounded"
        empty={!q.isLoading && !q.data?.grants.length}
        busy={q.isFetching}
        footer={
          <DataPagination
            page={page}
            pageSize={20}
            total={q.data?.total ?? 0}
            hasMore={Boolean(q.data?.hasMore)}
            onPageChange={(nextPage) => setParams({ page: String(nextPage) })}
          />
        }
      >
        <Stack divider={<Divider flexItem />}>
          {q.data?.grants.map((g) => (
            <Stack
              sx={{ py: 2, justifyContent: 'space-between', gap: 1 }}
              key={g.id}
              data-collection-item
              tabIndex={0}
              direction={{ xs: 'column', md: 'row' }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  {g.grantee.name || g.grantee.email} · {g.scope}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {g.client.firstName} {g.client.lastName} · {g.reason} · expires{' '}
                  {new Date(g.expiresAt).toLocaleString()}
                </Typography>
              </Box>
              {g.revokedAt ? (
                <Chip label="Revoked" />
              ) : (
                <Button
                  color="warning"
                  onClick={() =>
                    setSelectedGrant({
                      id: g.id,
                      label: `${g.grantee.name || g.grantee.email} · ${g.scope}`,
                    })
                  }
                >
                  Revoke immediately
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      </CollectionSurface>
      <GovernedActionDialog
        open={confirmCreate}
        title="Issue time-bounded scoped access"
        effect="Grant only the selected capability for the selected client and duration. This does not change role membership, staff assignment, or professional authority."
        context={`${options.data?.staff.find((item) => item.id === granteeId)?.name || options.data?.staff.find((item) => item.id === granteeId)?.email || 'Selected staff member'} · ${options.data?.clients.find((item) => item.id === clientId)?.firstName ?? 'Selected'} ${options.data?.clients.find((item) => item.id === clientId)?.lastName ?? 'client'}`}
        warning
        pending={create.isPending}
        preview={{
          current: 'No selected explicit scoped grant',
          proposed: `${humanizeCode(scope)} · ${capability} · ${durationDays} day${durationDays === 1 ? '' : 's'}`,
          scope: `Selected staff member and client only; purpose: ${grantReason}`,
          timing: 'Starts immediately and expires automatically at the displayed duration',
          reversibility: 'May be revoked immediately; immutable history is retained.',
          audit:
            'Issuer, grantee, client, capability, purpose, start, expiry, and outcome are recorded.',
        }}
        {...(create.isError ? { error: create.error.message } : {})}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => create.mutate()}
        confirmLabel="Issue scoped access"
      />
      <GovernedActionDialog
        open={Boolean(selectedGrant)}
        title="Revoke temporary access"
        effect="End this time-bounded client grant immediately. Role membership and immutable grant history are unchanged."
        {...(selectedGrant?.label ? { context: selectedGrant.label } : {})}
        warning
        pending={revoke.isPending}
        preview={{
          current: 'Active time-bounded scoped grant',
          proposed: 'Revoked grant retained in immutable history',
          scope: selectedGrant?.label ?? 'Selected grant only',
          timing: 'Immediately after confirmation',
          reversibility: 'Not reversible; a new least-privilege grant must be issued.',
          audit: 'Issuer, target, scope, reason, time, and outcome remain auditable.',
        }}
        {...(revoke.isError ? { error: revoke.error.message } : {})}
        onCancel={() => setSelectedGrant(null)}
        onConfirm={() => {
          if (selectedGrant) revoke.mutate(selectedGrant.id);
        }}
        confirmLabel="Revoke access"
      />
    </Stack>
  );
}
