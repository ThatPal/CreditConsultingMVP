import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type Role = 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL';
type Candidate = {
  id: string;
  productId: string;
  disposition: string;
  role: Role | null;
  internalRationale: string | null;
  clientSafeReason: string | null;
};
type Application = {
  candidateId: string;
  sequence: number;
  role: Role;
  internalRationale: string;
  clientSafeReason: string;
  timingRule: Record<string, string>;
  stopRule: Record<string, string>;
};
type StrategyVersion = {
  id: string;
  version: number;
  status: string;
  sourceContext: Record<string, unknown>;
  brief: Record<string, unknown>;
  aiProposal: Record<string, string[]> | null;
  validation: { valid?: boolean; errors?: string[] } | null;
  candidates: Candidate[];
  applications: Application[];
};
type StrategyView = {
  strategy: null | { id: string; roundId: string; status: string; version?: number };
  current?: StrategyVersion | null;
  approved: null | {
    version: number;
    approvedAt: string;
    cards: Array<{ productId: string; role: string; reason: string }>;
    sequence: Array<{ sequence: number; role: string; reason: string }>;
  };
  stale?: boolean;
  historical?: { version: number; approvedAt: string };
};
type Product = {
  id: string;
  displayName: string;
  audience: string;
  portfolioType: string;
  secured: boolean;
  issuer: { name: string };
  currentOfferVersion: null | { id: string; version: number; status: string; fresh: boolean };
  currentInsightVersion: null | { id: string; clientSafeSummary: string };
};

const roleLabel: Record<Role, string> = {
  PLANNED: 'Planned',
  ALTERNATIVE: 'Alternative',
  CONDITIONAL: 'Conditional / backup',
};
const defaultRules = {
  timingRule: { instruction: 'Confirm the current offer before applying.' },
  dependencyRule: { instruction: 'Wait until the prior outcome is recorded.' },
  stopRule: {
    onApproved: 'Pause and review',
    onDeclined: 'Stop and consult',
    onPending: 'Wait',
    onSkipped: 'Reconsider',
    onNotCompleted: 'Reconsider',
    onUnexpected: 'Stop and consult',
  },
  reconsiderationRule: {
    onApproved: 'Review remaining need',
    onDeclined: 'Consultant review',
    onPending: 'Do not continue',
    onSkipped: 'Resequence',
    onNotCompleted: 'Resequence',
    onUnexpected: 'Consultant review',
  },
};

export function ClientStrategyPage() {
  const { roundId = '' } = useParams();
  const query = useQuery({
    queryKey: ['client-strategy', roundId],
    queryFn: () => apiRequest<StrategyView>(`/api/v1/client/rounds/${roundId}/strategy`),
  });
  if (query.isLoading) return <CircularProgress aria-label="Loading strategy" />;
  if (query.isError || !query.data)
    return <Alert severity="error">Your strategy could not be loaded.</Alert>;
  if (query.data.stale)
    return (
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Current round"
          title="Your card strategy"
          description="Your consultant is reviewing an update."
        />
        <Alert severity="warning">
          Source information changed after strategy version {query.data.historical?.version} was
          approved. Outdated application guidance is hidden until an updated version is approved.
        </Alert>
      </Stack>
    );
  if (!query.data.approved)
    return (
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Current round"
          title="Your card strategy"
          description="Your consultant is preparing and reviewing your strategy."
        />
        <Alert severity="info">
          No strategy has been approved yet. Nothing is presented as a recommendation until
          consultant approval.
        </Alert>
      </Stack>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Approved strategy"
        title="Your card application plan"
        description="A clear sequence prepared and approved by your consultant."
      />
      <Alert severity="success">
        Strategy version {query.data.approved.version} is ready. Confirm current offer details with
        your consultant before applying.
      </Alert>
      <SectionCard>
        <Typography variant="h5">Your sequence</Typography>
        <Stack divider={<Divider flexItem />} spacing={2}>
          {query.data.approved.sequence.map((item) => (
            <Stack key={item.sequence} direction="row" spacing={2}>
              <Chip label={item.sequence} />
              <Stack>
                <Typography sx={{ fontWeight: 700 }}>
                  {roleLabel[item.role as Role] ?? item.role}
                </Typography>
                <Typography>{item.reason}</Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function ConsultantStrategyPage() {
  const { clientId = '', roundId = '' } = useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [approvalNote, setApprovalNote] = useState(
    'Reviewed against the frozen client context and current governed offers.',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const strategy = useQuery({
    queryKey: ['strategy', clientId, roundId],
    queryFn: () =>
      apiRequest<StrategyView>(`/api/v1/consultant/clients/${clientId}/rounds/${roundId}/strategy`),
  });
  const catalog = useQuery({
    queryKey: ['strategy-catalog', clientId, search],
    queryFn: () =>
      apiRequest<{ products: Product[] }>(
        `/api/v1/consultant/clients/${clientId}/strategy/catalog?search=${encodeURIComponent(search)}`,
      ),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['strategy', clientId, roundId] });
  const draft = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/consultant/clients/${clientId}/rounds/${roundId}/strategy/draft`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: refresh,
  });
  const saveCandidate = useMutation({
    mutationFn: (item: {
      productId: string;
      disposition: 'SHORTLISTED' | 'EXCLUDED';
      role?: Role;
      internalRationale?: string;
      clientSafeReason?: string;
    }) =>
      apiRequest(
        `/api/v1/consultant/clients/${clientId}/strategies/${strategy.data!.strategy!.id}/candidates/${item.productId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            expectedStrategyVersion: strategy.data!.strategy!.version,
            ...item,
          }),
        },
      ),
    onSuccess: refresh,
  });
  const saveSequence = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/consultant/clients/${clientId}/strategies/${strategy.data!.strategy!.id}/sequence`,
        {
          method: 'PUT',
          body: JSON.stringify({
            expectedStrategyVersion: strategy.data!.strategy!.version,
            items: applications.map((item, index) => ({
              ...defaultRules,
              ...item,
              sequence: index + 1,
            })),
          }),
        },
      ),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/consultant/clients/${clientId}/strategies/${strategy.data!.strategy!.id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({
            expectedStrategyVersion: strategy.data!.strategy!.version,
            approvalNote,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      ),
    onSuccess: () => {
      setConfirmOpen(false);
      refresh();
    },
  });
  const shortlisted = useMemo(
    () =>
      strategy.data?.current?.candidates.filter((item) => item.disposition === 'SHORTLISTED') ?? [],
    [strategy.data],
  );
  const products = useMemo(
    () =>
      (catalog.data?.products ?? []).filter(
        (product) => audience === 'ALL' || product.audience === audience,
      ),
    [catalog.data, audience],
  );
  const compared = products.filter((product) => compareIds.includes(product.id));

  useEffect(() => {
    const persisted = strategy.data?.current?.applications ?? [];
    setApplications(
      persisted.length
        ? [...persisted].sort((a, b) => a.sequence - b.sequence)
        : shortlisted.map((item, index) => ({
            candidateId: item.id,
            sequence: index + 1,
            role: item.role ?? 'PLANNED',
            internalRationale: item.internalRationale ?? '',
            clientSafeReason: item.clientSafeReason ?? '',
            ...defaultRules,
          })),
    );
  }, [strategy.data?.current?.id, strategy.data?.current?.applications.length, shortlisted.length]);

  const updateApplication = (candidateId: string, patch: Partial<Application>) =>
    setApplications((items) =>
      items.map((item) => (item.candidateId === candidateId ? { ...item, ...patch } : item)),
    );
  const move = (index: number, delta: number) =>
    setApplications((items) => {
      const target = index + delta;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  const toggleCompare = (productId: string) =>
    setCompareIds((ids) =>
      ids.includes(productId)
        ? ids.filter((id) => id !== productId)
        : ids.length < 5
          ? [...ids, productId]
          : ids,
    );
  const anyError = draft.error ?? saveCandidate.error ?? saveSequence.error ?? approve.error;

  if (strategy.isLoading) return <CircularProgress aria-label="Loading strategy workspace" />;
  if (strategy.isError)
    return <Alert severity="error">The Strategy workspace could not be loaded.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="CRM strategy workspace"
        title="Build the client’s Round strategy"
        description="AI may organize evidence and propose possibilities. You select, compare, sequence, validate, and approve."
      />
      {!strategy.data?.strategy ? (
        <SectionCard>
          <Stack spacing={2}>
            <Typography variant="h5">Prepare governed context</Typography>
            <Typography>
              Creates a source-frozen workspace. Manual research remains available if AI preparation
              is unavailable.
            </Typography>
            <Button variant="contained" disabled={draft.isPending} onClick={() => draft.mutate()}>
              Prepare strategy workspace
            </Button>
          </Stack>
        </SectionCard>
      ) : (
        <>
          {strategy.data.strategy.status === 'STALE' && (
            <Alert
              severity="warning"
              action={<Button onClick={() => draft.mutate()}>Create refreshed version</Button>}
            >
              Authoritative source data changed. Create a refreshed version before editing.
            </Alert>
          )}
          <SectionCard>
            <Stack spacing={2}>
              <Typography variant="h5">Source context</Typography>
              <Typography>
                Version {strategy.data.current?.version} freezes Round, Goal, Profile/Review, Plan,
                portfolio, Wishlist, entitlement, application history, major-check, and governed
                catalog dependencies.
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <Typography>
                  <b>Status:</b> {strategy.data.current?.status}
                </Typography>
                <Typography>
                  <b>Plan:</b>{' '}
                  {String(
                    (strategy.data.current?.sourceContext.plan as { status?: string } | null)
                      ?.status ?? 'Not available',
                  )}
                </Typography>
                <Typography>
                  <b>AI:</b> {String(strategy.data.current?.brief.status ?? 'Manual fallback')}
                </Typography>
              </Stack>
            </Stack>
          </SectionCard>
          <SectionCard>
            <Stack spacing={1}>
              <Typography variant="h5">AI brief</Typography>
              <Alert severity="info">
                Proposal only. AI cannot select, sequence, validate, approve, or publish.
              </Alert>
              {strategy.data.current?.aiProposal ? (
                Object.entries(strategy.data.current.aiProposal)
                  .filter(([, value]) => Array.isArray(value))
                  .map(([key, values]) => (
                    <Box key={key}>
                      <Typography sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                        {key}
                      </Typography>
                      <Typography>{values.join(' · ')}</Typography>
                    </Box>
                  ))
              ) : (
                <Typography>AI is pending or unavailable. Continue manually.</Typography>
              )}
            </Stack>
          </SectionCard>
          <SectionCard>
            <Stack spacing={2}>
              <Typography variant="h5">Search governed products</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Search issuer or product"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <FormControl sx={{ minWidth: 180 }}>
                  <InputLabel>Portfolio</InputLabel>
                  <Select
                    label="Portfolio"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                  >
                    <MenuItem value="ALL">All products</MenuItem>
                    <MenuItem value="PERSONAL">Personal</MenuItem>
                    <MenuItem value="BUSINESS">Business</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              {products.map((product) => {
                const selected = shortlisted.some(
                  (candidate) => candidate.productId === product.id,
                );
                return (
                  <Stack
                    key={product.id}
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={2}
                    sx={{
                      py: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Stack>
                      <Typography sx={{ fontWeight: 700 }}>
                        {product.issuer.name} · {product.displayName}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" label={product.audience} />
                        <Chip
                          size="small"
                          label={product.secured ? 'Secured' : product.portfolioType}
                        />
                        <Chip
                          size="small"
                          color={product.currentOfferVersion?.fresh ? 'success' : 'warning'}
                          label={
                            product.currentOfferVersion?.fresh
                              ? `Offer v${product.currentOfferVersion.version} current`
                              : 'Offer needs review'
                          }
                        />
                      </Stack>
                      <Typography>
                        {product.currentInsightVersion?.clientSafeSummary ??
                          'No current approved insight; use offer facts only.'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" sx={{ alignItems: 'center' }}>
                      <Checkbox
                        aria-label={`Compare ${product.displayName}`}
                        checked={compareIds.includes(product.id)}
                        disabled={!compareIds.includes(product.id) && compareIds.length >= 5}
                        onChange={() => toggleCompare(product.id)}
                      />
                      <Typography variant="caption">Compare</Typography>
                      <Button
                        disabled={selected}
                        onClick={() =>
                          saveCandidate.mutate({
                            productId: product.id,
                            disposition: 'SHORTLISTED',
                            role: 'PLANNED',
                            internalRationale: '',
                            clientSafeReason: '',
                          })
                        }
                      >
                        Shortlist
                      </Button>
                      <Button
                        onClick={() =>
                          saveCandidate.mutate({
                            productId: product.id,
                            disposition: 'EXCLUDED',
                            internalRationale: 'Excluded after consultant review.',
                          })
                        }
                      >
                        Exclude
                      </Button>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </SectionCard>
          {compared.length >= 2 && (
            <SectionCard>
              <Stack spacing={2}>
                <Typography variant="h5">Compare selected products ({compared.length})</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 2,
                  }}
                >
                  {compared.map((product) => (
                    <Box
                      key={product.id}
                      sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>{product.displayName}</Typography>
                      <Typography>
                        {product.issuer.name} · {product.audience} ·{' '}
                        {product.secured ? 'Secured' : product.portfolioType}
                      </Typography>
                      <Typography>
                        Offer{' '}
                        {product.currentOfferVersion?.fresh
                          ? `current v${product.currentOfferVersion.version}`
                          : 'not current'}
                      </Typography>
                      <Typography>
                        {product.currentInsightVersion?.clientSafeSummary ?? 'No approved insight'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </SectionCard>
          )}
          <SectionCard>
            <Stack spacing={2}>
              <Typography variant="h5">Shortlist decisions</Typography>
              {!shortlisted.length && (
                <Alert severity="info">
                  Nothing is selected automatically from AI or Wishlist.
                </Alert>
              )}
              {shortlisted.map((item) => (
                <CandidateEditor
                  key={item.id}
                  item={item}
                  product={catalog.data?.products.find((product) => product.id === item.productId)}
                  onSave={(patch) =>
                    saveCandidate.mutate({
                      productId: item.productId,
                      disposition: 'SHORTLISTED',
                      ...patch,
                    })
                  }
                  onRemove={() =>
                    saveCandidate.mutate({
                      productId: item.productId,
                      disposition: 'EXCLUDED',
                      internalRationale: 'Removed by consultant.',
                    })
                  }
                />
              ))}
            </Stack>
          </SectionCard>
          <SectionCard>
            <Stack spacing={2}>
              <Typography variant="h5">Sequence and execution rules</Typography>
              <Typography>
                Order cards and author separate internal and client-safe reasons. Skip, decline,
                pending, technical non-completion, and unexpected outcomes remain distinct.
              </Typography>
              {applications.map((item, index) => (
                <Box
                  key={item.candidateId}
                  sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {index + 1}. Selected product
                      </Typography>
                      <Stack direction="row">
                        <Button disabled={!index} onClick={() => move(index, -1)}>
                          Move up
                        </Button>
                        <Button
                          disabled={index === applications.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          Move down
                        </Button>
                      </Stack>
                    </Stack>
                    <FormControl>
                      <InputLabel>Role</InputLabel>
                      <Select
                        label="Role"
                        value={item.role}
                        onChange={(event) =>
                          updateApplication(item.candidateId, { role: event.target.value as Role })
                        }
                      >
                        {Object.entries(roleLabel).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Internal rationale"
                      multiline
                      value={item.internalRationale}
                      onChange={(event) =>
                        updateApplication(item.candidateId, {
                          internalRationale: event.target.value,
                        })
                      }
                    />
                    <TextField
                      label="Client-safe ‘Why this card?’"
                      multiline
                      value={item.clientSafeReason}
                      onChange={(event) =>
                        updateApplication(item.candidateId, {
                          clientSafeReason: event.target.value,
                        })
                      }
                    />
                    <TextField
                      label="Timing instruction"
                      value={item.timingRule.instruction ?? ''}
                      onChange={(event) =>
                        updateApplication(item.candidateId, {
                          timingRule: { instruction: event.target.value },
                        })
                      }
                    />
                  </Stack>
                </Box>
              ))}
              <Button
                disabled={!applications.length || saveSequence.isPending}
                onClick={() => saveSequence.mutate()}
              >
                Save and validate sequence
              </Button>
              {strategy.data.current?.validation && (
                <Alert severity={strategy.data.current.validation.valid ? 'success' : 'warning'}>
                  {strategy.data.current.validation.valid
                    ? 'Deterministic sequence validation passed.'
                    : `Resolve: ${(strategy.data.current.validation.errors ?? []).join(', ')}`}
                </Alert>
              )}
            </Stack>
          </SectionCard>
          <SectionCard>
            <Stack spacing={2}>
              <Typography variant="h5">Final validation and approval</Typography>
              <Typography>
                Approval revalidates every source, freezes exact facts, and requires recent MFA
                step-up.
              </Typography>
              <TextField
                fullWidth
                multiline
                label="Approval note"
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
              />
              <Button
                variant="contained"
                disabled={strategy.data.current?.status !== 'READY_FOR_APPROVAL'}
                onClick={() => setConfirmOpen(true)}
              >
                Review approval
              </Button>
            </Stack>
          </SectionCard>
        </>
      )}
      {anyError && <Alert severity="error">{anyError.message}</Alert>}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Approve immutable strategy?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              This freezes the source context, selected products, exact offer/insight versions,
              roles, order, rules, and client-safe reasons.
            </Typography>
            <Alert severity="warning">
              Confirm the facts and professional judgment. AI has no approval authority.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => approve.mutate()}>
            Approve strategy
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function CandidateEditor({
  item,
  product,
  onSave,
  onRemove,
}: {
  item: Candidate;
  product: Product | undefined;
  onSave: (patch: { role: Role; internalRationale: string; clientSafeReason: string }) => void;
  onRemove: () => void;
}) {
  const [role, setRole] = useState<Role>(item.role ?? 'PLANNED');
  const [internalRationale, setInternalRationale] = useState(item.internalRationale ?? '');
  const [clientSafeReason, setClientSafeReason] = useState(item.clientSafeReason ?? '');
  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Stack spacing={2}>
        <Typography sx={{ fontWeight: 700 }}>
          {product ? `${product.issuer.name} · ${product.displayName}` : item.productId}
        </Typography>
        <FormControl>
          <InputLabel>Strategy role</InputLabel>
          <Select
            label="Strategy role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {Object.entries(roleLabel).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Internal rationale"
          multiline
          value={internalRationale}
          onChange={(event) => setInternalRationale(event.target.value)}
        />
        <TextField
          label="Client-safe reason"
          multiline
          value={clientSafeReason}
          onChange={(event) => setClientSafeReason(event.target.value)}
        />
        <Stack direction="row">
          <Button
            variant="outlined"
            disabled={!internalRationale.trim() || !clientSafeReason.trim()}
            onClick={() => onSave({ role, internalRationale, clientSafeReason })}
          >
            Save decision
          </Button>
          <Button color="error" onClick={onRemove}>
            Remove
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
