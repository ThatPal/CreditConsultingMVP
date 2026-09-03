import { Alert, Button, Chip, LinearProgress, Stack, Typography as MuiTypography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
const Typography: any = MuiTypography;
type Summary = { round: { id: string; status: string }; sessionEnded: boolean; counts: Record<string, number>; knownApprovedAmount: number; unresolvedFollowUpCount: number; goal: null | { targetAmount: number; progressAmount: number; progressPercent: number }; applications: Array<{ id: string; productName: string; status: string; outcome: string | null; approvedLimit: string | null; approvedLimitKnown: boolean | null }> };
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());
export function PostRoundPage({ consultant = false }: { consultant?: boolean }) {
  const { clientId = '', roundId = '' } = useParams();
  const path = consultant ? `/api/v1/consultant/clients/${clientId}/rounds/${roundId}/post-round` : `/api/v1/client/rounds/${roundId}/post-round`;
  const query = useQuery({ queryKey: ['post-round', roundId, consultant], queryFn: () => apiRequest<Summary>(path) });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError || !query.data) return <Alert severity="error">The post-round summary could not be loaded.</Alert>;
  const data = query.data;
  return <Stack spacing={3}><PageHeader eyebrow="Card Round follow-up" title="Round results" description="A factual view of applications and known results. Pending items remain open until confirmed." />{!data.sessionEnded && <Alert severity="info">The live session has not ended. Totals will keep updating as results are recorded.</Alert>}<SectionCard><Stack spacing={2}><Typography variant="h5">Known progress</Typography><Typography variant="h3">${data.knownApprovedAmount.toLocaleString()}</Typography><Typography>Known approved credit · {data.counts.approved} approved · {data.counts.declined} declined · {data.counts.pending} pending</Typography>{data.goal && <><LinearProgress variant="determinate" value={data.goal.progressPercent} /><Typography>{data.goal.progressPercent}% of ${data.goal.targetAmount.toLocaleString()} goal</Typography></>}</Stack></SectionCard>{data.unresolvedFollowUpCount > 0 && <Alert severity="warning">{data.unresolvedFollowUpCount} result{data.unresolvedFollowUpCount === 1 ? '' : 's'} still need follow-up.</Alert>}<SectionCard><Typography variant="h5">Applications</Typography><Stack spacing={1.5}>{data.applications.length ? data.applications.map((item) => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between' }}><div><Typography fontWeight={700}>{item.productName}</Typography><Typography color="text.secondary">{item.outcome ? label(item.outcome) : label(item.status)}</Typography></div><Chip label={item.outcome === 'APPROVED' && item.approvedLimitKnown && item.approvedLimit ? `$${Number(item.approvedLimit).toLocaleString()} approved` : item.outcome === 'APPROVED' ? 'Approved · limit pending' : label(item.outcome ?? item.status)} /></Stack>) : <Typography>No released applications were submitted in this Round.</Typography>}</Stack></SectionCard><Button component={Link} to={consultant ? `/crm/clients/${clientId}` : `/app/rounds/${roundId}`}>Back to Round</Button></Stack>;
}
