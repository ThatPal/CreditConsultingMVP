import { Alert, Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type PublishedReview = {
  id: string;
  reviewId: string;
  publishedAt: string;
  recommendation: string;
  projection: {
    profile?: Record<string, unknown>;
    findings?: Array<{ code: string; title: string; summary: string; severity: string }>;
    recommendation?: { outcome: string; explanation: string; reasons: string[] };
    analysisSummary?: string;
  };
  report: null | {
    id: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    reportDate: string | null;
    reportSource: string | null;
    contentPath: string;
  };
};

type CreditCenterResponse = {
  current: PublishedReview | null;
  history: PublishedReview[];
  client?: { id: string; firstName: string; lastName: string };
};

const labels: Record<string, string> = {
  experianScore: 'Experian',
  equifaxScore: 'Equifax',
  transunionScore: 'TransUnion',
  aggregateUtilization: 'Utilization',
  revolvingBalance: 'Revolving balance',
  revolvingLimit: 'Revolving limit',
  openAccounts: 'Open accounts',
  recentInquiries: 'Recent inquiries',
  derogatoryItems: 'Derogatory items',
};

function valueLabel(key: string, value: unknown) {
  if (typeof value !== 'number') return String(value ?? 'Not reported');
  if (key === 'aggregateUtilization') return `${value}%`;
  if (key === 'revolvingBalance' || key === 'revolvingLimit') return `$${value.toLocaleString()}`;
  return value.toLocaleString();
}

export function PublishedCreditCenterPage({
  view,
}: {
  view: 'overview' | 'profile' | 'report' | 'analysis' | 'history';
}) {
  const query = useQuery({
    queryKey: ['published-credit-center'],
    queryFn: () => apiRequest<CreditCenterResponse>('/api/v1/client/credit-profile'),
    retry: false,
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return <Alert severity="error">Your published Credit Center could not be loaded.</Alert>;
  return <CreditCenterContent data={query.data!} view={view} basePath="/app/credit-center" />;
}

export function ConsultantClientCreditCenterPage() {
  const { clientId } = useParams();
  const query = useQuery({
    queryKey: ['consultant-published-credit-center', clientId],
    queryFn: () =>
      apiRequest<CreditCenterResponse>(`/api/v1/reviews/consultant/${clientId}/credit-center`),
    enabled: Boolean(clientId),
    retry: false,
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <Alert severity="error">
        This published client Credit Center is unavailable or outside your scope.
      </Alert>
    );
  return (
    <CreditCenterContent
      data={query.data!}
      view="overview"
      basePath={`/crm/clients/${clientId}/credit-center`}
      consultant
    />
  );
}

function CreditCenterContent({
  data,
  view,
  basePath,
  consultant = false,
}: {
  data: CreditCenterResponse;
  view: 'overview' | 'profile' | 'report' | 'analysis' | 'history';
  basePath: string;
  consultant?: boolean;
}) {
  const current = data.current;
  const projection = current?.projection;
  const profile = projection?.profile ?? {};
  const navigation = consultant
    ? []
    : ([
        ['overview', 'Overview'],
        ['profile', 'Profile'],
        ['report', 'Report'],
        ['analysis', 'Analysis'],
        ['history', 'History'],
      ] as const);
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={consultant ? 'CRM · Published Credit Center' : 'Credit Center'}
        title={
          consultant && data.client
            ? `${data.client.firstName} ${data.client.lastName}`
            : 'Your published Credit Review'
        }
        description="Only consultant-approved, published information appears here. Draft analysis and internal AI processing details are never shown."
      />
      {navigation.length > 0 && (
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', gap: 1 }}
          aria-label="Credit Center sections"
        >
          {navigation.map(([key, label]) => (
            <Button
              key={key}
              component={Link}
              to={key === 'overview' ? basePath : `${basePath}/${key}`}
              variant={view === key ? 'contained' : 'outlined'}
            >
              {label}
            </Button>
          ))}
        </Stack>
      )}
      {!current && (
        <Alert severity="info">
          No Credit Review has been published yet. Your consultant’s draft work remains private
          until publication.
        </Alert>
      )}
      {current && (view === 'overview' || consultant) && (
        <>
          <SectionCard variant="elevated">
            <Stack spacing={2}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
              >
                <Typography variant="h2">Current decision</Typography>
                <Chip color="primary" label={current.recommendation.replaceAll('_', ' ')} />
              </Stack>
              <Typography>
                {projection?.analysisSummary || 'No published summary was supplied.'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Published {new Date(current.publishedAt).toLocaleString()}
              </Typography>
            </Stack>
          </SectionCard>
          <Grid container spacing={2}>
            {Object.entries(profile)
              .slice(0, 8)
              .map(([key, value]) => (
                <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <SectionCard variant="operational">
                    <Typography color="text.secondary" variant="body2">
                      {labels[key] ?? key}
                    </Typography>
                    <Typography variant="h3">{valueLabel(key, value)}</Typography>
                  </SectionCard>
                </Grid>
              ))}
          </Grid>
          {consultant && (
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={Link} to={`/crm/clients/${data.client?.id}`}>
                Client context
              </Button>
              {current && (
                <Button
                  component={Link}
                  to={`/crm/clients/${data.client?.id}/reviews/${current.reviewId}`}
                >
                  Review record
                </Button>
              )}
            </Stack>
          )}
        </>
      )}
      {current && view === 'profile' && (
        <SectionCard variant="operational">
          <Typography variant="h2" gutterBottom>
            Published profile
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(profile).map(([key, value]) => (
              <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {labels[key] ?? key.replaceAll(/([A-Z])/g, ' $1')}
                  </Typography>
                  <Typography variant="h3">{valueLabel(key, value)}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      )}
      {current && view === 'report' && (
        <SectionCard variant="operational">
          <Typography variant="h2" gutterBottom>
            Source report
          </Typography>
          {current.report ? (
            <Stack spacing={1}>
              <Typography>{current.report.originalFileName}</Typography>
              <Typography color="text.secondary">
                {current.report.reportSource || 'Source not specified'} ·{' '}
                {new Date(
                  current.report.reportDate || current.report.uploadedAt,
                ).toLocaleDateString()}
              </Typography>
              <Button
                component="a"
                href={current.report.contentPath}
                target="_blank"
                rel="noreferrer"
                variant="contained"
              >
                Open secure report
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">No source report is attached to this publication.</Alert>
          )}
        </SectionCard>
      )}
      {current && view === 'analysis' && (
        <Stack spacing={2}>
          <SectionCard variant="elevated">
            <Typography variant="h2" gutterBottom>
              Consultant recommendation
            </Typography>
            <Typography>
              {projection?.recommendation?.explanation || 'No published explanation was supplied.'}
            </Typography>
            {projection?.recommendation?.reasons?.map((reason) => (
              <Chip key={reason} label={reason} sx={{ mr: 1, mt: 2 }} />
            ))}
          </SectionCard>
          {projection?.findings?.map((finding) => (
            <SectionCard key={finding.code} variant="operational">
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="h3">{finding.title}</Typography>
                <Chip label={finding.severity} />
              </Stack>
              <Typography sx={{ mt: 1 }}>{finding.summary}</Typography>
            </SectionCard>
          ))}
        </Stack>
      )}
      {current && view === 'history' && (
        <Stack spacing={2}>
          {data.history.map((item, index) => (
            <SectionCard key={item.id} variant={index === 0 ? 'elevated' : 'operational'}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
              >
                <Box>
                  <Typography variant="h3">
                    {new Date(item.publishedAt).toLocaleDateString()}
                  </Typography>
                  <Typography color="text.secondary">Review {item.reviewId.slice(0, 8)}</Typography>
                </Box>
                <Chip label={index === 0 ? 'Current' : item.recommendation.replaceAll('_', ' ')} />
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
