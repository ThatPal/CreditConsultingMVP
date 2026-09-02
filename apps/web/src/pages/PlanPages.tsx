import { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';

type Item = {
  stableKey: string;
  type: 'ACTION' | 'GUIDANCE' | 'MILESTONE';
  completionMode: 'ACKNOWLEDGEMENT' | 'STRUCTURED_OUTCOME' | 'CLIENT_REPORT_CONSULTANT_VERIFY' | 'CONSULTANT_VERIFY' | 'SYSTEM_VERIFY';
  owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM';
  clientTitle: string;
  clientBody: string | null;
  consultantRationale: string | null;
  sortOrder: number;
  required: boolean;
  pathKeys: string[];
};

const starterItems: Item[] = [
  { stableKey: 'review-guidance', type: 'GUIDANCE', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Review your credit findings', clientBody: 'Read the published findings before beginning your preparation actions.', consultantRationale: 'Establish shared context.', sortOrder: 0, required: true, pathKeys: [] },
  { stableKey: 'utilization-outcome', type: 'ACTION', completionMode: 'STRUCTURED_OUTCOME', owner: 'CLIENT', clientTitle: 'Report your balance progress', clientBody: 'Record the balance change after your planned payment.', consultantRationale: 'Captures an outcome without replacing the account record.', sortOrder: 1, required: true, pathKeys: [] },
  { stableKey: 'consultant-check', type: 'MILESTONE', completionMode: 'CONSULTANT_VERIFY', owner: 'CONSULTANT', clientTitle: 'Consultant verifies readiness', clientBody: 'Your consultant will confirm when this milestone is satisfied.', consultantRationale: 'Authoritative verification.', sortOrder: 2, required: true, pathKeys: [] },
];

export function ConsultantPlanBuilderPage() {
  const { clientId = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['plan-builder', clientId], queryFn: () => apiRequest<any>(`/api/v1/consultant/clients/${clientId}/plan`), enabled: Boolean(clientId) });
  const [title, setTitle] = useState('Credit preparation plan');
  const [items, setItems] = useState<Item[]>(starterItems);
  const draft = useMemo(() => ({ title, purpose: 'PREPARATION', sourceReviewId: query.data?.context.review?.id ?? null, sourceReviewVersion: 1, sourceGoalRevisionId: null, sourceProfileVersion: 1, items, dependencies: items.length > 1 ? items.slice(1).map((item, index) => ({ dependentKey: item.stableKey, prerequisiteKey: items[index]!.stableKey, mode: 'ALL' })) : [] }), [items, query.data, title]);
  const save = useMutation({
    mutationFn: async () => {
      const plan = query.data?.plan;
      if (!plan) return apiRequest(`/api/v1/consultant/clients/${clientId}/plans`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
      return apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${plan.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: plan.versions[0].optimisticVersion, draft }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-builder', clientId] }),
  });
  const approve = useMutation({ mutationFn: () => apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${query.data.plan.id}/approve`, { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-builder', clientId] }) });
  if (query.isLoading) return <Typography>Loading Plan Builder…</Typography>;
  if (query.isError) return <Alert severity="error">The Plan Builder could not be loaded safely.</Alert>;
  return <Stack spacing={3}>
    <PageHeader eyebrow="CRM-12" title="Plan Builder" description="Build a typed, dependency-aware client Plan. Display order never changes prerequisite truth." />
    {save.isError && <Alert severity="error">The draft could not be saved. Reload if another editor changed this Plan.</Alert>}
    <Card><CardContent><Stack spacing={2}>
      <TextField label="Plan title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Stack direction="row" spacing={1}><Chip label={`Status: ${query.data?.plan?.status ?? 'NEW'}`} /><Chip label={`Version: ${query.data?.plan?.versions?.[0]?.version ?? 1}`} /></Stack>
      {items.map((item, index) => <Card key={item.stableKey} variant="outlined"><CardContent><Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField select label="Type" value={item.type} onChange={(event) => setItems((current) => current.map((candidate, i) => i === index ? { ...candidate, type: event.target.value as Item['type'] } : candidate))}>{['ACTION','GUIDANCE','MILESTONE'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <TextField label="Client title" fullWidth value={item.clientTitle} onChange={(event) => setItems((current) => current.map((candidate, i) => i === index ? { ...candidate, clientTitle: event.target.value } : candidate))} />
        </Stack>
        <TextField label="Client guidance" multiline value={item.clientBody ?? ''} onChange={(event) => setItems((current) => current.map((candidate, i) => i === index ? { ...candidate, clientBody: event.target.value } : candidate))} />
        <TextField label="Consultant-only rationale" multiline value={item.consultantRationale ?? ''} onChange={(event) => setItems((current) => current.map((candidate, i) => i === index ? { ...candidate, consultantRationale: event.target.value } : candidate))} />
        <Stack direction="row" spacing={1}><Button disabled={index === 0} onClick={() => setItems((current) => { const next=[...current]; [next[index-1],next[index]]=[next[index]!,next[index-1]!]; return next.map((value,i)=>({...value,sortOrder:i})); })}>Move up</Button><Button color="error" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Remove</Button></Stack>
      </Stack></CardContent></Card>)}
      <Button onClick={() => setItems((current) => [...current, { ...starterItems[0]!, stableKey: `item-${crypto.randomUUID()}`, clientTitle: 'New guidance', sortOrder: current.length }])}>Add typed item</Button>
      <Divider />
      <Typography variant="h6">Client-safe preview</Typography>
      {items.map((item) => <Box key={item.stableKey}><Typography sx={{ fontWeight: 700 }}>{item.clientTitle}</Typography><Typography color="text.secondary">{item.clientBody}</Typography></Box>)}
      <Stack direction="row" spacing={2}><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save draft</Button><Button variant="contained" color="success" disabled={!query.data?.plan || approve.isPending} onClick={() => approve.mutate()}>Approve Plan</Button></Stack>
      <Typography variant="caption">Approval requires recent MFA step-up. Manual authoring remains available without AI.</Typography>
    </Stack></CardContent></Card>
  </Stack>;
}

export function ClientPlanPage() {
  const query = useQuery({ queryKey: ['client-plan'], queryFn: () => apiRequest<any>('/api/v1/client/plan') });
  if (query.isLoading) return <Typography>Loading your Plan…</Typography>;
  if (query.isError) return <Alert severity="error">Your Plan could not be loaded.</Alert>;
  if (!query.data?.plan) return <Stack spacing={2}><PageHeader eyebrow="Plan" title="Your next steps" description="An approved Plan will appear here when it is ready." /><Alert severity="info">No approved Plan is available yet.</Alert></Stack>;
  const plan = query.data.plan;
  return <Stack spacing={3}><PageHeader eyebrow="PORTAL-08" title={plan.title} description="Follow the available steps. Locked milestones open only when their prerequisites are satisfied." />{plan.version.staleAt && <Alert severity="warning">This Plan is being reviewed after a source change. Completed history remains available.</Alert>}<Stack spacing={2}>{plan.version.items.map((item: any) => <Card key={item.id}><CardContent><Stack spacing={1}><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="h6">{item.title}</Typography><Chip label={item.status.replaceAll('_',' ')} /></Stack><Typography>{item.body}</Typography>{item.prerequisites.length > 0 && item.status === 'LOCKED' && <Typography color="text.secondary">Available after: {item.prerequisites.map((value: any) => value.title).join(', ')}</Typography>}{item.deepLink && <Button component={Link} to={item.deepLink}>Open related area</Button>}</Stack></CardContent></Card>)}</Stack></Stack>;
}
