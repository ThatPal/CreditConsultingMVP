import { useState } from 'react';
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
type Case = {
  id: string;
  clientId: string;
  intentType: string;
  targetTiming?: string;
  clientContext?: string;
  status: string;
  version: number;
  recommendation?: { id: string; type: string; clientSafeExplanation: string };
  decision?: { type: string; clientSafeExplanation: string };
  restrictions: Array<{ id: string; scope: string; clearedAt?: string }>;
  timeline: Array<{ id: string; type: string; createdAt: string }>;
};
const label = (v: string) =>
  v
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
export function MajorReadinessPage({
  view = 'intake',
}: {
  view?: 'intake' | 'readiness' | 'preparation' | 'coordination' | 'timeline';
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['major-readiness'],
    queryFn: () => apiRequest<{ case: Case | null }>('/api/v1/major-readiness-v2/client/case'),
    retry: false,
  });
  const [intentType, setIntent] = useState('MORTGAGE');
  const [timing, setTiming] = useState('Within 6 months');
  const [context, setContext] = useState('');
  const start = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/major-readiness-v2/client/cases', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ intentType, targetTiming: timing, clientContext: context }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['major-readiness'] }),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  if (q.isError) return <Alert severity="error">Unable to load Major Credit Readiness.</Alert>;
  const c = q.data?.case;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Major Credit Readiness"
        title={view === 'intake' ? 'Coordinate your major application' : label(view)}
        description="Coordinate mortgage, auto, student-loan, or other major financing timing with your credit-card activity. Guidance is advisory and never predicts lender approval."
      />
      {!c ? (
        <SectionCard>
          <Stack spacing={2}>
            <TextField
              select
              label="Major application type"
              value={intentType}
              onChange={(e) => setIntent(e.target.value)}
            >
              {['MORTGAGE', 'AUTO', 'STUDENT', 'OTHER_MAJOR_FINANCING', 'NOT_SURE'].map((x) => (
                <MenuItem value={x} key={x}>
                  {label(x)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Expected timing"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
            />
            <TextField
              label="Context (optional)"
              multiline
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <Button variant="contained" disabled={start.isPending} onClick={() => start.mutate()}>
              Start readiness case
            </Button>
            {start.error && <Alert severity="error">{start.error.message}</Alert>}
          </Stack>
        </SectionCard>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {['intake', 'readiness', 'preparation', 'coordination', 'timeline'].map((x) => (
              <Button
                component={Link}
                key={x}
                to={x === 'intake' ? '/app/major-readiness' : `/app/major-readiness/${x}`}
                variant={view === x ? 'contained' : 'outlined'}
              >
                {label(x)}
              </Button>
            ))}
          </Stack>
          <SectionCard>
            <Stack spacing={1}>
              <Chip label={label(c.status)} color={c.status === 'COMPLETE' ? 'success' : 'info'} />
              <Typography variant="h5">{label(c.intentType)}</Typography>
              <Typography>{c.targetTiming || 'Timing not supplied'}</Typography>
              {c.clientContext && <Typography color="text.secondary">{c.clientContext}</Typography>}
            </Stack>
          </SectionCard>
          {view === 'readiness' && (
            <SectionCard>
              <Typography variant="h5">Consultant-approved guidance</Typography>
              {c.recommendation ? (
                <>
              <Typography sx={{ fontWeight: 700 }}>{label(c.recommendation.type)}</Typography>
                  <Typography>{c.recommendation.clientSafeExplanation}</Typography>
                </>
              ) : (
                <Alert severity="info">Your consultant is preparing guidance.</Alert>
              )}
            </SectionCard>
          )}
          {view === 'preparation' && (
            <SectionCard>
              <Typography variant="h5">Preparation Plan</Typography>
              <Typography>
                Preparation uses your shared Plan so work remains visible in one place.
              </Typography>
              <Button component={Link} to="/app/plan">
                Open Plan
              </Button>
            </SectionCard>
          )}
          {view === 'coordination' && (
            <SectionCard>
              <Typography variant="h5">Card-activity coordination</Typography>
              {c.decision ? (
                <>
              <Typography sx={{ fontWeight: 700 }}>{label(c.decision.type)}</Typography>
                  <Typography>{c.decision.clientSafeExplanation}</Typography>
                  {c.restrictions
                    .filter((r) => !r.clearedAt)
                    .map((r) => (
                      <Chip key={r.id} label={`${label(r.scope)} paused`} />
                    ))}
                </>
              ) : (
                <Alert severity="info">No approved coordination decision yet.</Alert>
              )}
            </SectionCard>
          )}
          {view === 'timeline' && (
            <SectionCard>
              <Typography variant="h5">Timeline</Typography>
              {c.timeline.length ? (
                c.timeline.map((e) => (
                  <Stack key={e.id}>
                  <Typography sx={{ fontWeight: 700 }}>{label(e.type)}</Typography>
                    <Typography color="text.secondary">
                      {new Date(e.createdAt).toLocaleString()}
                    </Typography>
                  </Stack>
                ))
              ) : (
                <Typography>No history yet.</Typography>
              )}
            </SectionCard>
          )}
        </>
      )}
    </Stack>
  );
}

export function ConsultantMajorReadinessPage() {
  const { clientId, caseId } = useParams();
  const qc = useQueryClient();
  const [type, setType] = useState('PREPARE_FIRST');
  const [explanation, setExplanation] = useState(
    'Prepare the current profile and coordinate timing before new card activity. This is advisory guidance, not a prediction of lender approval.',
  );
  const q = useQuery({
    queryKey: ['crm-major', clientId, caseId],
    queryFn: () =>
      apiRequest<{ case: Case }>(
        `/api/v1/major-readiness-v2/consultant/clients/${clientId}/cases/${caseId}`,
      ),
    enabled: !!clientId && !!caseId,
  });
  const post = (path: string, body: unknown) =>
    apiRequest(`/api/v1/major-readiness-v2/consultant/clients/${clientId}/cases/${caseId}${path}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body),
    });
  const draft = useMutation({
    mutationFn: () => post('/recommendations', { type, clientSafeExplanation: explanation }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-major', clientId, caseId] }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => post(`/recommendations/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-major', clientId, caseId] }),
  });
  const decision = useMutation({
    mutationFn: (decisionType: string) =>
      post('/decisions', { type: decisionType, clientSafeExplanation: explanation }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-major', clientId, caseId] }),
  });
  const clear = useMutation({
    mutationFn: () =>
      post('/restrictions/clear', {
        reason: 'Current reassessment supports release; all downstream checks must rerun.',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-major', clientId, caseId] }),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  if (q.isError || !q.data?.case)
    return <Alert severity="error">Unable to load this client case.</Alert>;
  const c = q.data.case;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="CRM · Major Readiness"
        title={`${label(c.intentType)} coordination`}
        description="Consultant decisions are explicit, attributable, and separate from AI preparation or lender outcomes."
      />
      <SectionCard>
        <Stack spacing={2}>
          <TextField
            select
            label="Recommendation"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['PROCEED_NOW', 'PREPARE_FIRST', 'REASSESS_LATER'].map((x) => (
              <MenuItem key={x} value={x}>
                {label(x)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            multiline
            label="Client-safe explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          <Button variant="contained" onClick={() => draft.mutate()}>
            Prepare draft
          </Button>
          {c.recommendation && (
            <>
              <Alert severity="success">Approved: {c.recommendation.clientSafeExplanation}</Alert>
            </>
          )}
          {!c.recommendation && (
            <Typography>Draft preparation and explicit approval are separate actions.</Typography>
          )}
          <Button
            disabled={!c.recommendation}
            onClick={() => c.recommendation && approve.mutate(c.recommendation.id)}
          >
            Approve current recommendation
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack spacing={1}>
          <Typography variant="h5">Coordination decision</Typography>
          <Button color="warning" onClick={() => decision.mutate('PAUSE_CARD_ACTIVITY')}>
            Pause all card activity
          </Button>
          <Button onClick={() => decision.mutate('LIMIT_CARD_ACTIVITY')}>
            Limit card activity
          </Button>
          <Button onClick={() => decision.mutate('NO_RESTRICTION')}>No restriction required</Button>
          <Button variant="outlined" onClick={() => clear.mutate()}>
            Release restrictions with revalidation
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
