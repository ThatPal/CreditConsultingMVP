import AddRounded from '@mui/icons-material/AddRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { SectionCard } from '../components/common/SectionCard';

export type Business = {
  id: string;
  legalName: string;
  displayName: string | null;
  entityType: string | null;
  industry: string | null;
  ownershipPercent: string | number | null;
  status: string;
  version: number;
  archivedAt: string | null;
};
export type Relationship = {
  id: string;
  institutionName: string;
  relationshipType: string;
  approximateTenure: string | null;
  clientBusinessId: string | null;
  clientNote: string | null;
  status: string;
  version: number;
  closedAt: string | null;
  clientBusiness: { id: string; legalName: string; displayName: string | null } | null;
};
export type ClientContext = {
  id: string;
  firstName: string;
  lastName: string;
  businesses: Business[];
  financialRelationships: Relationship[];
};

const idempotency = () => crypto.randomUUID();

function EditorDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h2">{title}</Typography>
          {children}
        </Stack>
      </Box>
    </Drawer>
  );
}

export function ClientContextSections() {
  const client = useQueryClient();
  const [businessEditor, setBusinessEditor] = useState<Business | 'new' | null>(null);
  const [relationshipEditor, setRelationshipEditor] = useState<Relationship | 'new' | null>(null);
  const query = useQuery({
    queryKey: ['client-context'],
    queryFn: () => apiRequest<{ context: ClientContext }>('/api/v1/client/context'),
    retry: false,
  });
  const saveBusiness = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const values = Object.fromEntries(new FormData(form));
      const existing = businessEditor !== 'new' ? businessEditor : null;
      const body = {
        legalName: values.legalName,
        displayName: values.displayName || null,
        entityType: values.entityType || null,
        industry: values.industry || null,
        ownershipPercent: values.ownershipPercent ? Number(values.ownershipPercent) : null,
        ...(existing ? { version: existing.version } : {}),
      };
      return apiRequest(
        existing ? `/api/v1/client/businesses/${existing.id}` : '/api/v1/client/businesses',
        {
          method: existing ? 'PATCH' : 'POST',
          headers: existing ? undefined : { 'Idempotency-Key': idempotency() },
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: async () => {
      setBusinessEditor(null);
      await client.invalidateQueries({ queryKey: ['client-context'] });
    },
  });
  const saveRelationship = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const values = Object.fromEntries(new FormData(form));
      const existing = relationshipEditor !== 'new' ? relationshipEditor : null;
      const body = {
        institutionName: values.institutionName,
        relationshipType: values.relationshipType,
        approximateTenure: values.approximateTenure || null,
        clientBusinessId: values.clientBusinessId || null,
        clientNote: values.clientNote || null,
        ...(existing ? { version: existing.version } : {}),
      };
      return apiRequest(
        existing
          ? `/api/v1/client/financial-relationships/${existing.id}`
          : '/api/v1/client/financial-relationships',
        {
          method: existing ? 'PATCH' : 'POST',
          headers: existing ? undefined : { 'Idempotency-Key': idempotency() },
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: async () => {
      setRelationshipEditor(null);
      await client.invalidateQueries({ queryKey: ['client-context'] });
    },
  });
  const closeItem = useMutation({
    mutationFn: ({ path, version }: { path: string; version: number }) =>
      apiRequest(path, { method: 'POST', body: JSON.stringify({ version }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['client-context'] }),
  });

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>
        Relationship context could not be loaded.
      </Alert>
    );
  const context = query.data!.context;
  const activeBusinesses = context.businesses.filter((item) => item.status !== 'ARCHIVED');
  return (
    <>
      <SectionCard>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
          >
            <Box>
              <Typography variant="h3">Businesses</Typography>
              <Typography color="text.secondary">
                Optional business identities connected to you. Personal-only clients do not need to
                add one.
              </Typography>
            </Box>
            <Button
              startIcon={<AddRounded />}
              variant="contained"
              onClick={() => setBusinessEditor('new')}
            >
              Add business
            </Button>
          </Stack>
          {activeBusinesses.length === 0 && (
            <Alert icon={<BusinessRounded />} severity="info">
              No businesses added. That is a complete and valid personal-only profile.
            </Alert>
          )}
          {context.businesses.map((item) => (
            <Box
              key={item.id}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between' }}
              >
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 850 }}>
                      {item.displayName || item.legalName}
                    </Typography>
                    <Chip
                      size="small"
                      label={item.status}
                      color={item.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {[item.legalName, item.entityType, item.industry].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {item.status !== 'ARCHIVED' && (
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => setBusinessEditor(item)}>Edit</Button>
                    <Button
                      color="error"
                      onClick={() =>
                        closeItem.mutate({
                          path: `/api/v1/client/businesses/${item.id}/archive`,
                          version: item.version,
                        })
                      }
                    >
                      Archive
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
          >
            <Box>
              <Typography variant="h3">Financial institution relationships</Typography>
              <Typography color="text.secondary">
                Optional high-level context only. Never enter account or routing numbers, balances,
                usernames, passwords, security answers, or login credentials.
              </Typography>
            </Box>
            <Button
              startIcon={<AddRounded />}
              variant="contained"
              onClick={() => setRelationshipEditor('new')}
            >
              Add relationship
            </Button>
          </Stack>
          {context.financialRelationships.length === 0 && (
            <Alert icon={<AccountBalanceRounded />} severity="info">
              No voluntary relationships added. You can leave this section empty.
            </Alert>
          )}
          {context.financialRelationships.map((item) => (
            <Box
              key={item.id}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between' }}
              >
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 850 }}>{item.institutionName}</Typography>
                    <Chip
                      size="small"
                      label={item.status}
                      color={item.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {item.relationshipType.replaceAll('_', ' ')}
                    {item.clientBusiness
                      ? ` · ${item.clientBusiness.displayName || item.clientBusiness.legalName}`
                      : ''}
                    {item.approximateTenure ? ` · ${item.approximateTenure}` : ''}
                  </Typography>
                  {item.clientNote && (
                    <Typography variant="body2" sx={{ mt: 0.75 }}>
                      {item.clientNote}
                    </Typography>
                  )}
                </Box>
                {item.status !== 'CLOSED' && (
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => setRelationshipEditor(item)}>Edit</Button>
                    <Button
                      color="error"
                      onClick={() =>
                        closeItem.mutate({
                          path: `/api/v1/client/financial-relationships/${item.id}/close`,
                          version: item.version,
                        })
                      }
                    >
                      Mark closed
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
      <EditorDrawer
        open={Boolean(businessEditor)}
        title={businessEditor === 'new' ? 'Add business' : 'Edit business'}
        onClose={() => setBusinessEditor(null)}
      >
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            saveBusiness.mutate(event.currentTarget);
          }}
        >
          <TextField
            name="legalName"
            label="Legal name"
            defaultValue={businessEditor !== 'new' ? businessEditor?.legalName : ''}
            required
          />
          <TextField
            name="displayName"
            label="Display name (optional)"
            defaultValue={businessEditor !== 'new' ? businessEditor?.displayName : ''}
          />
          <TextField
            name="entityType"
            label="Entity type (optional)"
            defaultValue={businessEditor !== 'new' ? businessEditor?.entityType : ''}
          />
          <TextField
            name="industry"
            label="Industry (optional)"
            defaultValue={businessEditor !== 'new' ? businessEditor?.industry : ''}
          />
          <TextField
            name="ownershipPercent"
            label="Ownership percentage (optional)"
            type="number"
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
            defaultValue={businessEditor !== 'new' ? (businessEditor?.ownershipPercent ?? '') : ''}
          />
          {saveBusiness.isError && <Alert severity="error">{saveBusiness.error.message}</Alert>}
          <Divider />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setBusinessEditor(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveBusiness.isPending}>
              {saveBusiness.isPending ? 'Saving…' : 'Save business'}
            </Button>
          </Stack>
        </Stack>
      </EditorDrawer>
      <EditorDrawer
        open={Boolean(relationshipEditor)}
        title={relationshipEditor === 'new' ? 'Add relationship' : 'Edit relationship'}
        onClose={() => setRelationshipEditor(null)}
      >
        <Alert severity="warning">
          Do not enter account numbers, routing numbers, balances, or any banking login information.
        </Alert>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            saveRelationship.mutate(event.currentTarget);
          }}
        >
          <TextField
            name="institutionName"
            label="Institution name"
            defaultValue={relationshipEditor !== 'new' ? relationshipEditor?.institutionName : ''}
            required
          />
          <TextField
            name="relationshipType"
            label="Relationship type"
            select
            defaultValue={
              relationshipEditor !== 'new' ? relationshipEditor?.relationshipType : 'CHECKING'
            }
          >
            {['CHECKING', 'SAVINGS', 'BUSINESS_BANKING', 'OTHER'].map((value) => (
              <MenuItem key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="approximateTenure"
            label="Approximate tenure (optional)"
            placeholder="For example, since 2021"
            defaultValue={relationshipEditor !== 'new' ? relationshipEditor?.approximateTenure : ''}
          />
          <TextField
            name="clientBusinessId"
            label="Related business (optional)"
            select
            defaultValue={
              relationshipEditor !== 'new' ? (relationshipEditor?.clientBusinessId ?? '') : ''
            }
          >
            <MenuItem value="">Personal relationship</MenuItem>
            {activeBusinesses.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.displayName || item.legalName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="clientNote"
            label="Context note (optional)"
            multiline
            minRows={3}
            defaultValue={relationshipEditor !== 'new' ? relationshipEditor?.clientNote : ''}
            helperText="General relationship context only; maximum 500 characters."
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {saveRelationship.isError && (
            <Alert severity="error">{saveRelationship.error.message}</Alert>
          )}
          <Divider />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setRelationshipEditor(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveRelationship.isPending}>
              {saveRelationship.isPending ? 'Saving…' : 'Save relationship'}
            </Button>
          </Stack>
        </Stack>
      </EditorDrawer>
    </>
  );
}
