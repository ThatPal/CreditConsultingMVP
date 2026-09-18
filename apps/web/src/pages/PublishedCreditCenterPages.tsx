import { FocusOwner } from '../components/common/FocusOwner';
import { CreditOverview } from '../features/credit-center/CreditOverview';
import { AnalysisFinding } from '../features/credit-center/AnalysisFinding';
import { useCreditCenterHubRestore } from '../features/credit-center/hubPosition';
import { CreditHistory } from '../features/credit-center/CreditHistory';
import { adaptPublishedProfile, formatReportDate } from '../features/credit-center/data';
import {
  BureauScoreGallery,
  CreditMetricStrip,
  UtilizationCapacity,
} from '../features/credit-center/CreditData';
import { CreditProfile } from '../features/credit-center/CreditProfile';
import { ReportAccounts } from '../features/credit-center/ReportAccounts';
import { CreditCenterDestinations } from '../features/credit-center/CreditCenterNavigation';
import { WorkspaceBlockers } from '../components/common/WorkspaceBlockers';
import { creditWorkspaceRefetchInterval } from '../queries/creditWorkspace';
import { CreditNextStep } from '../components/common/CreditNextStep';
import { ProfileCurrentnessNotice } from '../components/common/ProfileCurrentnessNotice';
import { CreditSourceReport } from '../components/common/CreditSourceReport';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import { designTokens } from '../theme';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { ReferenceQueryState } from '../components/common/ReferenceQueryState';
import { DraftPublicationStatus } from '../components/common/ProductFoundation';
import { PublishedCreditFacts } from '../components/common/PublishedCreditFacts';
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
    refetchInterval: creditWorkspaceRefetchInterval,
    queryFn: () => apiRequest<CreditCenterResponse>('/api/v1/client/credit-profile'),
    retry: false,
  });
  if (query.isLoading)
    return (
      <Stack spacing={2}>
        <ReferenceQueryState title="Credit Center" loading headingComponent="h2" />
      </Stack>
    );
  if (query.isError)
    return (
      <Stack spacing={2}>
        <ReferenceQueryState
          title="Credit Center"
          headingComponent="h2"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </Stack>
    );
  return <CreditCenterContent data={query.data!} view={view} />;
}

export function ConsultantClientCreditCenterPage() {
  const { clientId } = useParams();
  const query = useQuery({
    queryKey: creditWorkspaceKeys.consultantCreditCenter(clientId),
    refetchInterval: creditWorkspaceRefetchInterval,
    queryFn: () =>
      apiRequest<CreditCenterResponse>(`/api/v1/reviews/consultant/${clientId}/credit-center`),
    enabled: Boolean(clientId),
    retry: false,
  });
  if (query.isLoading) return <ReferenceQueryState title="Credit Center" loading />;
  if (query.isError)
    return (
      <Alert severity="error">
        This published client Credit Center is unavailable or outside your scope.
      </Alert>
    );
  return <CreditCenterContent data={query.data!} view="overview" consultant />;
}

function CreditCenterContent({
  data,
  view,
  consultant = false,
}: {
  data: CreditCenterResponse;
  view: 'overview' | 'profile' | 'report' | 'analysis' | 'history';
  consultant?: boolean;
}) {
  useCreditCenterHubRestore(!consultant && view === 'overview');
  if (!consultant && view === 'overview') return <CreditOverview read={data} />;
  const current = data.current;
  const projection = current?.projection;
  const profile = projection?.profile ?? {};
  const experience = adaptPublishedProfile(profile, current?.report?.reportDate ?? null);
  const publishedDate = current ? new Date(current.publishedAt).toLocaleDateString() : undefined;
  return (
    <Stack spacing={3}>
      {consultant && (
        <>
          <PageHeader
            eyebrow={consultant ? 'CRM · Published Credit Center' : 'Credit Center'}
            title={
              consultant && data.client
                ? `${data.client.firstName} ${data.client.lastName}`
                : {
                    overview: 'Your credit, in context',
                    profile: 'Credit Profile',
                    report: 'Report Details',
                    analysis: 'Analysis',
                    history: 'Credit over time',
                  }[view]
            }
            description={
              {
                overview:
                  'Your credit picture, what it means, how it has changed, and what to do next.',
                profile: 'Understand the facts and calculations in your reviewed credit picture.',
                report:
                  'Browse the evidence behind your Credit Profile and access the original report.',
                analysis:
                  'Read what your consultant identified, why it matters, and what comes next.',
                history:
                  'Compare what was known at each publication without losing the source context.',
              }[view]
            }
          />
          {current && (
            <Typography variant="body2" color="text.secondary">
              {current.report?.reportSource ?? 'Published Credit Review'} · Report{' '}
              {current.report?.reportDate
                ? formatReportDate(current.report.reportDate)
                : 'date unavailable'}{' '}
              · Published {publishedDate}
            </Typography>
          )}
        </>
      )}
      {current && <ProfileCurrentnessNotice profile={data.workspace?.profile} />}
      {!consultant && <WorkspaceBlockers blockers={data.workspace?.blockers} />}
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
          <Typography variant="h2">
            {view === 'profile'
              ? data.workspace?.profile?.status === 'REVIEW_IN_PROGRESS'
                ? 'Your Credit Profile is being prepared'
                : 'Your Credit Profile starts with a Review'
              : 'No published Credit Review yet'}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            {view === 'profile'
              ? data.workspace?.profile?.status === 'REVIEW_IN_PROGRESS'
                ? 'Your Credit Profile is being prepared as part of your Review. Published facts will appear here when it is complete.'
                : 'Your Credit Profile will appear after your first Review is published.'
              : 'Your published credit facts and consultant assessment will appear here after a review is completed. Check your review options to see whether you can start a review or continue one already in progress.'}
          </Typography>
          {!consultant && (
            <Button component={Link} to="/app/credit-center/review" variant="contained">
              Check your Credit Review
            </Button>
          )}
        </Stack>
      )}
      {current && consultant && (
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
      {current && !consultant && view === 'overview' && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,7fr) minmax(0,5fr)' },
              gap: 2,
            }}
          >
            <BureauScoreGallery scores={experience.scores} />
            <UtilizationCapacity data={experience} />
          </Box>
          <CreditMetricStrip data={experience} />
          <Box component="section">
            <Typography variant="h2">What stands out</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Published consultant observations
            </Typography>
            {projection?.findings?.length ? (
              projection.findings.slice(0, 3).map((f) => (
                <Box key={f.code} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h4" component="h3">
                    {f.title}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>{f.summary}</Typography>
                  <Button
                    component={Link}
                    to={'/app/credit-center/analysis#finding-' + encodeURIComponent(f.code)}
                  >
                    Read this finding
                  </Button>
                </Box>
              ))
            ) : (
              <Typography sx={{ mt: 2 }}>
                No individual findings were included in this publication.
              </Typography>
            )}
          </Box>
          <Box
            component="section"
            aria-label="Published assessment"
            sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 3, py: 1 }}
          >
            <Typography variant="overline">Your consultant’s assessment</Typography>
            <Typography variant="h2">Published assessment</Typography>
            <Typography sx={{ mt: 2, maxWidth: 800 }}>
              {projection?.analysisSummary || 'No published summary was supplied.'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Published {publishedDate}
            </Typography>
            <Box>
              <Button component={Link} to="/app/credit-center/analysis">
                Read full Analysis
              </Button>
            </Box>
          </Box>
          {data.workspace && <CreditNextStep workspace={data.workspace} />}
          <Button component={Link} to="/app/credit-center/plan" sx={{ alignSelf: 'flex-start' }}>
            View Plan in Credit Center
          </Button>
        </>
      )}
      {!current && !consultant && data.workspace && view === 'overview' && (
        <CreditNextStep workspace={data.workspace} />
      )}
      {current && view === 'profile' && (
        <CreditProfile
          data={experience}
          reportDate={current.report?.reportDate ?? null}
          publishedAt={current.publishedAt}
        />
      )}
      {current && view === 'report' && (
        <Stack spacing={4}>
          <Typography color="text.secondary">
            Browse the evidence behind your Credit Profile. The original report remains the source
            record.
          </Typography>
          <BureauScoreGallery scores={experience.scores} />
          <ReportAccounts accounts={experience.accounts} />
          <Box id="inquiries">
            <Typography variant="h3" component="h2">
              Inquiries & negative information
            </Typography>
            <Typography color="text.secondary">
              Individual entries, bureau details and payment-history records were not included in
              this published digest. They remain available in the original report where supplied.
            </Typography>
          </Box>
          <CreditSourceReport report={current.report} />
          <Box>
            <Button component={Link} to="/app/credit-center/profile">
              Understand your Credit Profile
            </Button>
            <Button component={Link} to="/app/credit-center/analysis">
              Read your consultant’s Analysis
            </Button>
          </Box>
        </Stack>
      )}
      {current && view === 'analysis' && (
        <Stack
          spacing={3}
          sx={{
            p: { xs: 2.5, md: 5 },
            borderRadius: 2,
            bgcolor: '#f2f4ef',
            color: '#1a302b',
            '& .MuiTypography-root': { color: 'inherit' },
            '& .MuiButton-root': { color: '#185c4a' },
            '& .MuiButton-root:focus-visible': { outlineColor: '#185c4a !important' },
            '& .MuiButton-outlined': { borderColor: '#64756d' },
            '& .MuiChip-root': { color: '#1a302b', bgcolor: '#dee7df' },
          }}
        >
          <Box
            component="section"
            aria-label="Published recommendation"
            sx={{
              p: 0,
              borderRadius: 0,
              background: 'transparent',
              border: 0,
              borderColor: 'divider',
            }}
          >
            <InsightsRounded sx={{ color: '#185c4a', mb: 2 }} />
            <Typography variant="h2" gutterBottom>
              Consultant recommendation
            </Typography>
            <Typography sx={{ mb: 2 }}>
              {projection?.analysisSummary || 'No consultant summary was included.'}
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
                  '& li::marker': { color: '#185c4a' },
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
            <Button component={Link} to="/app/credit-center/plan" variant="outlined">
              Open Credit Plan
            </Button>
          </Box>
          <Box component="section" aria-label="Published consultant findings">
            <Typography variant="h3" component="h2">
              Published consultant findings · {projection?.findings?.length ?? 0}
            </Typography>
            {!projection?.findings?.length && (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No individual findings were included in this publication.
              </Typography>
            )}
            {projection?.findings?.map((finding) => (
              <AnalysisFinding key={finding.code} finding={finding} />
            ))}
          </Box>
        </Stack>
      )}
      {current && !consultant && view === 'analysis' && data.workspace && (
        <Box component="section" sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
          <Typography variant="h3" component="h2">
            What happens next
          </Typography>
          <FocusOwner owner={data.workspace.currentFocus.owner} />
          <Typography sx={{ mt: 2 }}>{data.workspace.currentFocus.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {data.workspace.currentFocus.detail}
          </Typography>
          <Button component={Link} to={data.workspace.currentFocus.action}>
            {data.workspace.currentFocus.actionLabel}
          </Button>
        </Box>
      )}
      {!consultant && view === 'overview' && (
        <>
          <CreditCenterDestinations />
          <Box component="section" sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
            <Typography variant="h3" component="h2">
              From evidence to your next step
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              {[
                ['report', 'Report facts'],
                ['profile', 'Credit Profile'],
                ['analysis', 'Analysis'],
                ['plan', 'Plan'],
              ].map(([area, label], index) => (
                <Box key={area}>
                  <Button component={Link} to={'/app/credit-center/' + area}>
                    {label}
                  </Button>
                  {index < 3 && <span aria-hidden="true">→</span>}
                </Box>
              ))}
            </Stack>
            <Typography color="text.secondary">
              Explore the evidence, understand your consultant’s interpretation, and continue your
              published work.
            </Typography>
            <Button component={Link} to="/app/journey">
              View goal & Journey
            </Button>
          </Box>
        </>
      )}
      {current && view === 'history' && (
        <Stack spacing={4}>
          <CreditHistory snapshots={data.history} />
          <CreditReviewHistory history={data.history} latestId={current.id} />
        </Stack>
      )}{' '}
      {!consultant && (
        <Button
          component={Link}
          sx={{ alignSelf: 'flex-start' }}
          to={
            current
              ? '/app/support?new=1&category=CREDIT_REVIEW&subject=Question%20about%20my%20Credit%20Review&contextType=CREDIT_REVIEW&contextId=' +
                encodeURIComponent(current.reviewId)
              : '/app/support?new=1&category=CREDIT_REVIEW'
          }
        >
          {current ? 'Ask about this review' : 'Ask about credit reviews'}
        </Button>
      )}
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
            id={'snapshot-' + item.id}
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
                <BureauScoreGallery
                  scores={
                    adaptPublishedProfile(
                      item.projection.profile ?? {},
                      item.report?.reportDate ?? null,
                    ).scores
                  }
                />
                <CreditMetricStrip
                  data={adaptPublishedProfile(
                    item.projection.profile ?? {},
                    item.report?.reportDate ?? null,
                  )}
                />
                <CreditSourceReport report={item.report} />
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Box>
  );
}
