import { Alert, Box, Button, Chip, Divider, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { RecoveryState } from '../components/common/InteractionPatterns';
import {
  ArchetypeCanvas,
  DraftPublicationStatus,
  EventTimeline,
  FreshnessIndicator,
  MetricHero,
  ProductiveEmptyState,
  ProvenanceDetails,
  ScoreBand,
  UtilizationGauge,
} from '../components/common/ProductFoundation';
import { CollectionSurface } from '../components/common/CollectionSurface';

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
    return <RecoveryState error={query.error} onRetry={() => void query.refetch()} />;
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
  const scoreEntry = ['experianScore', 'equifaxScore', 'transunionScore']
    .map((key) => [key, profile[key]] as const)
    .find(([, value]) => typeof value === 'number');
  const utilization =
    typeof profile.aggregateUtilization === 'number' ? profile.aggregateUtilization : null;
  const publishedDate = current ? new Date(current.publishedAt).toLocaleDateString() : undefined;
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
        description="Understand your current published financial picture, what your consultant identified, and the next Plan action."
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
          <Button component={Link} to="/app/plan" variant="outlined">
            Plan
          </Button>
          <Button
            component={Link}
            to="/app/support?new=1&category=CREDIT_REVIEW&subject=Question%20about%20my%20Credit%20Review&contextType=CREDIT_REVIEW"
            variant="text"
          >
            Ask about this review
          </Button>
        </Stack>
      )}
      {!current && (
        <ProductiveEmptyState
          title="Your published Credit Review is being prepared"
          reason="Draft analysis stays private until your consultant confirms it is ready. You do not need to interpret unfinished results."
          owner="Your consultant"
          action={
            !consultant ? (
              <Button component={Link} to="/app/credit-center/review" variant="contained">
                Check your Credit Review
              </Button>
            ) : undefined
          }
        />
      )}
      {current && (view === 'overview' || consultant) && (
        <>
          <ArchetypeCanvas
            archetype="financial-dashboard"
            role={consultant ? 'consultant' : 'client'}
          >
            <Stack spacing={2}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
              >
                <Box>
                  <Typography variant="overline" color="primary">
                    Published understanding
                  </Typography>
                  <Typography variant="h2">What matters now</Typography>
                </Box>
                <Chip color="primary" label={current.recommendation.replaceAll('_', ' ')} />
              </Stack>
              <Typography>
                {projection?.analysisSummary || 'No published summary was supplied.'}
              </Typography>
              <DraftPublicationStatus state="published" owner="Your consultant" />
              <FreshnessIndicator state="confirmed" at={current.publishedAt} />
            </Stack>
          </ArchetypeCanvas>
          <ArchetypeCanvas
            archetype="financial-dashboard"
            role={consultant ? 'consultant' : 'client'}
            sx={{ background: 'linear-gradient(145deg, #f8fbff, #eaf3f8)', color: '#102038' }}
          >
            <Grid container spacing={3} sx={{ alignItems: 'center' }}>
              {scoreEntry && (
                <Grid size={{ xs: 12, md: 5 }}>
                  <ScoreBand
                    value={scoreEntry[1] as number}
                    source={`${labels[scoreEntry[0]]} · published Credit Profile`}
                    {...(publishedDate ? { asOf: publishedDate } : {})}
                  />
                </Grid>
              )}
              {utilization !== null && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <UtilizationGauge
                    value={utilization}
                    source="Published Credit Profile"
                    {...(publishedDate ? { asOf: publishedDate } : {})}
                  />
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 3 }}>
                <MetricHero
                  label="Open accounts"
                  value={
                    typeof profile.openAccounts === 'number' ? profile.openAccounts : 'Not reported'
                  }
                  explanation="Accounts included in the published profile."
                  source="Published Credit Profile"
                  {...(publishedDate ? { asOf: publishedDate } : {})}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
              {Object.entries(profile)
                .filter(
                  ([key]) =>
                    ![
                      'experianScore',
                      'equifaxScore',
                      'transunionScore',
                      'aggregateUtilization',
                      'openAccounts',
                    ].includes(key),
                )
                .slice(0, 6)
                .map(([key, value]) => (
                  <Grid key={key} size={{ xs: 6, md: 2 }}>
                    <Typography variant="caption">
                      {labels[key] ?? key.replaceAll(/([A-Z])/g, ' $1')}
                    </Typography>
                    <Typography variant="h3">{valueLabel(key, value)}</Typography>
                  </Grid>
                ))}
            </Grid>
          </ArchetypeCanvas>
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
        <ArchetypeCanvas
          archetype="financial-dashboard"
          role="client"
          sx={{ background: 'linear-gradient(145deg, #f8fbff, #eaf3f8)', color: '#102038' }}
        >
          <Typography variant="h2" gutterBottom>
            Published profile
          </Typography>
          <DraftPublicationStatus state="published" owner="Your consultant" />
          <Grid container spacing={3} sx={{ mt: 1 }}>
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
          <ProvenanceDetails
            source="Consultant-published Credit Profile"
            {...(publishedDate ? { asOf: publishedDate } : {})}
            method="Facts are grouped and formatted from the current published Review; no approval or score-change prediction is calculated."
          />
        </ArchetypeCanvas>
      )}
      {current && view === 'report' && (
        <ArchetypeCanvas archetype="client-workbench" role="client">
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
                Preview secure source report
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">
              No source report is attached. Your published Profile and Analysis remain available;
              ask Support if you expected a report.
            </Alert>
          )}
          <ProvenanceDetails
            source={current.report?.reportSource || 'Published Credit Review'}
            {...(current.report?.reportDate || current.report?.uploadedAt
              ? { asOf: (current.report?.reportDate || current.report?.uploadedAt)! }
              : {})}
            method="This document is the evidence source used for the published Profile and consultant interpretation."
          />
        </ArchetypeCanvas>
      )}
      {current && view === 'analysis' && (
        <Stack spacing={2}>
          <ArchetypeCanvas archetype="guided-decision" role="client">
            <Typography variant="h2" gutterBottom>
              Consultant recommendation
            </Typography>
            <Typography>
              {projection?.recommendation?.explanation || 'No published explanation was supplied.'}
            </Typography>
            {projection?.recommendation?.reasons?.map((reason) => (
              <Chip key={reason} label={reason} sx={{ mr: 1, mt: 2 }} />
            ))}
            <DraftPublicationStatus state="published" owner="Your consultant" />
            <Button component={Link} to="/app/plan" variant="contained">
              Review the Plan actions for these findings
            </Button>
          </ArchetypeCanvas>
          <CollectionSurface
            title={`Prioritized consultant findings · ${projection?.findings?.length ?? 0}`}
            mode="bounded"
          >
            {projection?.findings?.map((finding) => (
              <SectionCard key={finding.code} variant="operational">
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="h3">{finding.title}</Typography>
                  <Chip label={finding.severity} />
                </Stack>
                <Typography sx={{ mt: 1 }}>
                  Your consultant identified this because: {finding.summary}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Your Plan connects this finding to the actions your consultant has approved for
                  you.
                </Typography>
              </SectionCard>
            ))}
          </CollectionSurface>
        </Stack>
      )}
      {current && view === 'history' && (
        <ArchetypeCanvas archetype="lifecycle-timeline" role="client">
          <EventTimeline
            title="Published Credit Review history"
            events={data.history.map((item, index) => ({
              id: item.id,
              title:
                index === 0 ? 'Current published Credit Review' : 'Earlier published Credit Review',
              at: item.publishedAt,
              detail: `${item.recommendation.replaceAll('_', ' ')}. Historical versions remain reference-only and never replace current truth.`,
            }))}
          />
        </ArchetypeCanvas>
      )}
    </Stack>
  );
}
