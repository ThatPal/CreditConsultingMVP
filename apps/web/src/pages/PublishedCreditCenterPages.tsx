import { ProfileCurrentnessNotice } from '../components/common/ProfileCurrentnessNotice';
import { CreditSourceReport } from '../components/common/CreditSourceReport';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import NearMeRounded from '@mui/icons-material/NearMeRounded';
import { designTokens } from '../theme';
import { useEffect, useRef } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { RecoveryState } from '../components/common/InteractionPatterns';
import { DraftPublicationStatus } from '../components/common/ProductFoundation';
import { PublishedCreditFacts } from '../components/common/PublishedCreditFacts';
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
      {current && <ProfileCurrentnessNotice profile={data.workspace?.profile} />}
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
            sx={{
              overflowX: 'auto',
              maxWidth: '100%',
              flexShrink: 1,
              p: 0.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: '16px',
              bgcolor: 'rgba(4,13,25,.42)',
            }}
          >
            {navigation.map(([key, label]) => (
              <Button
                key={key}
                component={Link}
                to={key === 'overview' ? basePath : `${basePath}/${key}`}
                variant="text"
                aria-current={view === key ? 'page' : undefined}
                sx={{
                  borderRadius: '12px',
                  flexShrink: 0,
                  color: view === key ? '#092820' : 'text.secondary',
                  background: view === key ? designTokens.gradient.brand : 'transparent',
                  '&:hover': {
                    background: view === key ? designTokens.gradient.brand : 'action.hover',
                  },
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
          sx={{
            p: { xs: 3, md: 5 },
            border: 1,
            borderRadius: '24px',
            borderColor: 'divider',
            background: designTokens.gradient.data,
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '18px',
              display: 'grid',
              placeItems: 'center',
              background: designTokens.gradient.active,
              color: 'primary.main',
            }}
          >
            <ArticleOutlined sx={{ fontSize: 30 }} />
          </Box>
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
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: consultant || !data.workspace ? '1fr' : 'minmax(0, 1.65fr) minmax(280px, 1fr)',
              },
              gap: 2.5,
            }}
          >
            <Box
              component="section"
              aria-label="Published assessment"
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '24px',
                p: { xs: 3, md: 4 },
                background: designTokens.gradient.advisory,
                color: designTokens.color.focusText,
                boxShadow: '0 16px 48px rgba(0,0,0,.16)',
                '& .MuiTypography-root': { color: 'inherit' },
                '& .MuiChip-root': { color: '#174936', borderColor: '#aac5b5', bgcolor: '#d5e8da' },
              }}
            >
              <Stack spacing={2} sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '16px',
                    bgcolor: '#164c3c',
                    color: '#c6efbd',
                    boxShadow: '0 6px 20px #164c3c22',
                  }}
                >
                  <InsightsRounded />
                </Box>
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
            {!consultant && data.workspace && <CreditNextStep workspace={data.workspace} />}
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
      {!current && !consultant && data.workspace && view === 'overview' && (
        <CreditNextStep workspace={data.workspace} />
      )}
      {current && view === 'profile' && (
        <PublishedCreditFacts
          profile={profile}
          reportDate={current.report?.reportDate ?? null}
          publishedAt={current.publishedAt}
        />
      )}
      {current && view === 'report' && <CreditSourceReport report={current.report} />}
      {current && view === 'analysis' && (
        <Stack spacing={2}>
          <Box
            component="section"
            aria-label="Published recommendation"
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: '24px',
              background: designTokens.gradient.focus,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <InsightsRounded sx={{ color: 'primary.main', mb: 2 }} />
            <Typography variant="h2" gutterBottom>
              Consultant recommendation
            </Typography>
            <Typography>
              {projection?.recommendation?.explanation || 'No published explanation was supplied.'}
            </Typography>
            {!!projection?.recommendation?.reasons?.length && (
              <Box
                component="ul"
                sx={{
                  pl: 3,
                  my: 2,
                  '& li': { pl: 1, mb: 1, lineHeight: 1.7 },
                  '& li::marker': { color: 'primary.main' },
                }}
              >
                {projection.recommendation.reasons.map((reason, index) => (
                  <Box component="li" key={index}>
                    {reason}
                  </Box>
                ))}
              </Box>
            )}
            <DraftPublicationStatus state="published" owner="Your consultant" />
            <Button component={Link} to="/app/plan" variant="contained">
              Open Credit Plan
            </Button>
          </Box>
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
              <Box
                key={finding.code}
                sx={{
                  py: 3,
                  borderBottom: 1,
                  borderColor: 'divider',
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0,1fr)',
                  gap: 2,
                }}
              >
                <ArticleOutlined aria-hidden="true" sx={{ color: 'primary.main', mt: 0.5 }} />
                <Box>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
                  >
                    <Typography variant="h3">{finding.title}</Typography>
                    <Chip
                      size="small"
                      label={finding.severity.replaceAll('_', ' ').toLowerCase()}
                    />
                  </Stack>
                  <Typography sx={{ mt: 1 }}>{finding.summary}</Typography>
                </Box>
              </Box>
            ))}
          </CollectionSurface>
        </Stack>
      )}
      {current && view === 'history' && (
        <CreditReviewHistory history={data.history} latestId={current.id} />
      )}
    </Stack>
  );
}

function CreditNextStep({ workspace }: { workspace: CreditWorkspaceRead }) {
  return (
    <Stack
      component="section"
      aria-label="Your next step"
      spacing={2}
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: '24px',
        border: 1,
        borderColor: 'divider',
        background: designTokens.gradient.focus,
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <NearMeRounded sx={{ color: 'primary.main' }} />
        <Typography variant="overline">Your next step</Typography>
      </Stack>
      <Box>
        <Typography variant="h3">{workspace.currentFocus.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          {workspace.currentFocus.detail}
        </Typography>
      </Box>
      <Typography variant="body2">
        Actions remaining: {workspace.plan.openActionCount} · {workspace.plan.completedActionCount}{' '}
        completed
      </Typography>
      <Button
        component={Link}
        to={workspace.currentFocus.action}
        endIcon={<ArrowForwardRounded />}
        variant="contained"
        sx={{ alignSelf: 'flex-start' }}
      >
        {workspace.currentFocus.actionLabel}
      </Button>
    </Stack>
  );
}

export function CreditReviewHistory({
  history,
  latestId,
}: {
  history: PublishedReview[];
  latestId: string;
}) {
  return (
    <Box component="section" aria-label="Published Credit Review history">
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
        <HistoryRounded sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h2">Published Credit Review history</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Explore the assessment and credit facts saved with each publication.
          </Typography>
        </Box>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A publication records what was known then. Check your current Plan for what to do now.
      </Typography>
      {!history.length && <Typography>No publication history is available.</Typography>}
      <Stack spacing={2}>
        {history.map((item) => (
          <Accordion
            key={item.id}
            slotProps={{ transition: { mountOnEnter: true, unmountOnExit: true } }}
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: '20px !important',
              background: item.id === latestId ? designTokens.gradient.data : 'background.paper',
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRounded />}
              sx={{
                px: { xs: 2, md: 3 },
                py: 1,
                '& .MuiAccordionSummary-content': { minWidth: 0 },
              }}
            >
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="primary">
                  {new Date(item.publishedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Typography>
                <Typography variant="h3">
                  {item.id === latestId
                    ? 'Latest published Credit Review'
                    : 'Earlier published Credit Review'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.recommendation.replaceAll('_', ' ').toLowerCase()} · View saved assessment
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
              <Stack spacing={3}>
                <Box sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 2 }}>
                  <Typography variant="overline">Assessment at publication</Typography>
                  <Typography sx={{ mt: 1 }}>
                    {item.projection.analysisSummary ||
                      'No assessment summary was included in this publication.'}
                  </Typography>
                  {item.projection.recommendation?.explanation && (
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {item.projection.recommendation.explanation}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {item.report?.reportSource
                    ? 'Report source: ' + item.report.reportSource
                    : 'Report source not supplied'}
                  . This saved publication is read-only.
                </Typography>
                <PublishedCreditFacts
                  embedded
                  profile={item.projection.profile ?? {}}
                  reportDate={item.report?.reportDate ?? null}
                  publishedAt={item.publishedAt}
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Box>
  );
}
