import { useEffect, useRef } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { RecoveryState } from '../components/common/InteractionPatterns';
import {
  ArchetypeCanvas,
  DraftPublicationStatus,
  EventTimeline,
  ProvenanceDetails,
} from '../components/common/ProductFoundation';
import { PublishedCreditFacts } from '../components/common/PublishedCreditFacts';
import { webEnv } from '../config/env';
import { CollectionSurface } from '../components/common/CollectionSurface';
import { creditWorkspaceKeys, type CreditWorkspaceRead } from '../queries/creditWorkspace';

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
  workspace?: CreditWorkspaceRead;
  current: PublishedReview | null;
  history: PublishedReview[];
  client?: { id: string; firstName: string; lastName: string };
};

export function PublishedCreditCenterPage({
  view,
}: {
  view: 'overview' | 'profile' | 'report' | 'analysis' | 'history';
}) {
  const query = useQuery({
    queryKey: creditWorkspaceKeys.creditCenter(),
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
    queryKey: creditWorkspaceKeys.consultantCreditCenter(clientId),
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
  const sections = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = sections.current;
    const selected = container?.querySelector('[aria-current="page"]');
    if (!container || !selected) return;
    const viewport = container.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.right > viewport.right) container.scrollLeft += item.right - viewport.right;
    else if (item.left < viewport.left) container.scrollLeft += item.left - viewport.left;
  }, [view]);
  const current = data.current;
  const projection = current?.projection;
  const profile = projection?.profile ?? {};
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
            : {
                overview: 'Your credit, in context',
                profile: 'Your Credit Profile',
                report: 'Your source report',
                analysis: 'Your credit analysis',
                history: 'Your review history',
              }[view]
        }
        description="Explore your published facts, understand your consultant’s findings, and follow your Plan."
      />
      {current && data.workspace && !data.workspace.profile.isCurrent && (
        <Alert severity="warning">
          This published review remains available as history.{' '}
          {data.workspace.profile.reason === 'EXPIRED'
            ? 'Its assessment has expired.'
            : 'Its current status needs consultant review.'}
        </Alert>
      )}
      {navigation.length > 0 && (
        <Stack
          direction="row"
          useFlexGap
          sx={{ flexWrap: 'wrap', gap: 1 }}
          component="nav"
          aria-label="Credit Center sections"
        >
          <Stack
            ref={sections}
            direction="row"
            sx={{ overflowX: 'auto', maxWidth: '100%', flexShrink: 1 }}
          >
            {navigation.map(([key, label]) => (
              <Button
                key={key}
                component={Link}
                to={key === 'overview' ? basePath : `${basePath}/${key}`}
                variant="text"
                aria-current={view === key ? 'page' : undefined}
                sx={{
                  borderRadius: 0,
                  flexShrink: 0,
                  borderBottom: 2,
                  borderColor: view === key ? 'primary.main' : 'transparent',
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Button component={Link} to="/app/plan" variant="outlined">
            Plan
          </Button>
          <Button
            component={Link}
            to={
              current
                ? `/app/support?new=1&category=CREDIT_REVIEW&subject=Question%20about%20my%20Credit%20Review&contextType=CREDIT_REVIEW&contextId=${encodeURIComponent(current.reviewId)}`
                : '/app/support?new=1&category=CREDIT_REVIEW'
            }
            variant="text"
          >
            {current ? 'Ask about this review' : 'Ask about credit reviews'}
          </Button>
        </Stack>
      )}
      {!current && (
        <Stack
          spacing={2}
          sx={{ py: 3, borderBottom: 1, borderColor: 'divider', alignItems: 'flex-start' }}
        >
          <Typography variant="h2">No published Credit Review yet</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            Your published credit facts and consultant assessment will appear here after a review is
            completed. Check your review options to see whether you can start a review or continue
            one already in progress.
          </Typography>
          {!consultant && (
            <Button component={Link} to="/app/credit-center/review" variant="contained">
              Check your Credit Review
            </Button>
          )}
        </Stack>
      )}
      {current && (view === 'overview' || consultant) && (
        <>
          <Box
            component="section"
            aria-label="Published assessment"
            sx={{ borderLeft: 3, borderColor: 'primary.main', pl: { xs: 2, md: 3 }, py: 1 }}
          >
            <Stack spacing={2}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
              >
                <Box>
                  <Typography variant="overline" color="primary">
                    Your consultant’s assessment
                  </Typography>
                  <Typography variant="h2">Published assessment</Typography>
                </Box>
                <Chip
                  color="primary"
                  label={current.recommendation.replaceAll('_', ' ').toLowerCase()}
                />
              </Stack>
              <Typography>
                {projection?.analysisSummary || 'No published summary was supplied.'}
              </Typography>
              <DraftPublicationStatus state="published" owner="Your consultant" />
              <Typography variant="caption" color="text.secondary">
                Published {publishedDate}. See the report date below for the age of the source
                information.
              </Typography>
            </Stack>
          </Box>
          <PublishedCreditFacts
            profile={profile}
            reportDate={current.report?.reportDate ?? null}
            publishedAt={current.publishedAt}
          />
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
      {!consultant && data.workspace && view === 'overview' && (
        <Stack spacing={1} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Typography variant="overline">Your next step</Typography>
          <Typography variant="h3">{data.workspace.currentFocus.title}</Typography>
          <Typography color="text.secondary">{data.workspace.currentFocus.detail}</Typography>
          <Typography variant="body2">
            Actions remaining: {data.workspace.plan.openActionCount} ·{' '}
            {data.workspace.plan.completedActionCount} completed
          </Typography>
          <Button
            component={Link}
            to={data.workspace.currentFocus.action}
            sx={{ alignSelf: 'flex-start' }}
          >
            {data.workspace.currentFocus.actionLabel}
          </Button>
        </Stack>
      )}
      {current && view === 'profile' && (
        <PublishedCreditFacts
          profile={profile}
          reportDate={current.report?.reportDate ?? null}
          publishedAt={current.publishedAt}
        />
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
                {current.report.reportDate
                  ? `Report dated ${new Date(current.report.reportDate).toLocaleDateString()}`
                  : 'Report date unavailable'}
              </Typography>
              <Button
                component="a"
                href={`${webEnv.VITE_API_URL}${current.report.contentPath}`}
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
              Open Credit Plan
            </Button>
          </ArchetypeCanvas>
          <CollectionSurface
            title={`Published consultant findings · ${projection?.findings?.length ?? 0}`}
            appearance="plain"
            mode="bounded"
          >
            {!projection?.findings?.length && (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No individual findings were included in this publication.
              </Typography>
            )}
            {projection?.findings?.map((finding) => (
              <Box key={finding.code} sx={{ py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="h3">{finding.title}</Typography>
                  <Chip label={finding.severity} />
                </Stack>
                <Typography sx={{ mt: 1 }}>{finding.summary}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Review your Credit Plan for current actions and guidance.
                </Typography>
              </Box>
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
                index === 0 ? 'Latest published Credit Review' : 'Earlier published Credit Review',
              at: item.publishedAt,
              detail: `${item.recommendation.replaceAll('_', ' ')}. Historical versions remain reference-only and never replace current truth.`,
            }))}
          />
        </ArchetypeCanvas>
      )}
    </Stack>
  );
}
