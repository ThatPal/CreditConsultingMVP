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
      <SectionCard>
        <Typography variant="h6">{query.data?.total ?? 0} users</Typography>
        <Stack divider={<Divider flexItem />}>
          {query.data?.users.map((user) => (
            <Box key={user.id} sx={{ py: 2 }}>
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
                    <Chip size="small" label={user.role} />
                    <Chip size="small" label={user.status} />
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
          {!query.isLoading && !query.data?.users.length && (
            <Typography color="text.secondary">No users match these filters.</Typography>
          )}
        </Stack>
      </SectionCard>
      <DataPagination
        page={page}
        pageSize={20}
        total={query.data?.total ?? 0}
        hasMore={Boolean(query.data?.hasMore)}
        onPageChange={(next) => set('page', String(next))}
      />
    </Stack>
  );
}

export function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const query = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => apiRequest<{ user: UserDetail }>(`/api/v1/admin/users/${userId}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-user', userId] });
  const mutation = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) =>
      command(url, method, body),
    onSuccess: refresh,
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
  if (!user) return <Alert severity="error">User could not be loaded.</Alert>;
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
            onClick={() => {
              if (
                confirm(
                  `Change ${user.email} from ${user.role} to ${nextRole} and revoke all sessions?`,
                )
              )
                mutation.mutate({
                  url: `/api/v1/admin/users/${user.id}/role`,
                  method: 'PATCH',
                  body: { role: nextRole, expectedUpdatedAt: user.updatedAt },
                });
            }}
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
            onClick={() => {
              if (confirm(`Reset MFA and revoke every session for ${user.email}?`))
                mutation.mutate({
                  url: `/api/v1/admin/users/${user.id}/mfa-reset`,
                  method: 'POST',
                });
            }}
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
                onClick={() =>
                  mutation.mutate({
                    url: `/api/v1/admin/users/${user.id}/sessions/${s.id}`,
                    method: 'DELETE',
                  })
                }
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
                <Button
                  onClick={() =>
                    mutation.mutate({
                      url: `/api/v1/admin/assignments/${a.id}/deactivate`,
                      method: 'POST',
                    })
                  }
                >
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
    </Stack>
  );
}

export function AdminAccessGrantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-grants'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Scoped access grants"
        description="Review and immediately revoke time-bounded client access."
      />
      <SectionCard>
        <Typography variant="h6">Grant history</Typography>
        <Stack divider={<Divider flexItem />}>
          {q.data?.grants.map((g) => (
            <Stack
              sx={{ py: 2, justifyContent: 'space-between', gap: 1 }}
              key={g.id}
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
                <Button color="warning" onClick={() => revoke.mutate(g.id)}>
                  Revoke immediately
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      </SectionCard>
      <DataPagination
        page={page}
        pageSize={20}
        total={q.data?.total ?? 0}
        hasMore={Boolean(q.data?.hasMore)}
        onPageChange={setPage}
      />
    </Stack>
  );
}
