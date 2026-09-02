import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiBlobRequest, apiFileRequest, apiRequest } from '../auth/api';
import { ChoiceCard } from '../components/common/ChoiceCard';
import { LoadingSkeleton } from '../components/common/Feedback';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

const bureauSeries = [
  { key: 'experianScore', label: 'Experian', color: '#45d7f0' },
  { key: 'equifaxScore', label: 'Equifax', color: '#8d7cff' },
  { key: 'transunionScore', label: 'TransUnion', color: '#38dfa7' },
] as const;

type Review = {
  id: string;
  status: string;
  generalReadiness: string;
  recommendation: string | null;
  readinessExpiresAt: string | null;
  completedAt?: string | null;
  nextReviewRecommendedAt?: string | null;
  clientSummary: string | null;
  intake: {
    reportDocumentKey: string | null;
    reportSource: string | null;
    reportDate: string | null;
    reportDocument?: {
      id: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
    } | null;
    informationRequest?: { reasons: string[]; note?: string } | null;
    recentApplications?: RecentApplication[] | null;
    accountUpdates?: AccountUpdate[] | null;
    creditAccountsConfirmed?: boolean | null;
    creditAccountReviews?: CreditAccountReview[] | null;
    materialChanges?: string[] | null;
    materialChangeDetails?: Array<{ type: string; details: string }> | null;
  } | null;
  snapshot: null | {
    capturedAt: string;
    expiresAt?: string;
    source?: string | null;
    aggregateUtilization: number | null;
    revolvingLimit: number | null;
    revolvingBalance: number | null;
    openAccounts: number | null;
    recentInquiries: number | null;
    derogatoryItems: number | null;
    experianScore: number | null;
    equifaxScore: number | null;
    transunionScore: number | null;
    scoreModel?: string | null;
    averageAccountAgeMonths: number | null;
    oldestAccountAgeMonths?: number | null;
    revolvingAccounts?: number | null;
    installmentAccounts?: number | null;
    latePayments?: number | null;
    collections?: number | null;
    chargeOffs?: number | null;
    bankruptcies?: number | null;
    accounts: Array<{
      id: string;
      creditorName: string;
      accountType: string;
      creditLimit: number | null;
      balance: number | null;
      paymentStatus: string | null;
      isOpen: boolean;
    }>;
  };
  findings: Array<{ id: string; label: string; severity: string; description: string | null }>;
  client?: {
    firstName: string;
    lastName: string;
    creditSnapshots: NonNullable<Review['snapshot']>[];
  };
};

type ReviewEligibility = {
  state: 'ELIGIBLE' | 'BLOCKED_OLDER_OR_SAME' | 'ACTIVE_REVIEW' | 'PURCHASE_REQUIRED';
  eligible: boolean;
  reason: string;
  intendedReportDate: string;
  latestAcceptedReportDate: string | null;
  activeReviewId: string | null;
  credits: { available: number; reserved: number; consumed: number; expired: number };
  nextPath: string;
};

type RecentApplication = {
  issuer: string;
  date: string;
  outcome: 'APPROVED' | 'PENDING' | 'DECLINED' | 'ABANDONED';
  scope: 'PERSONAL' | 'BUSINESS';
  approvedAmount?: number | undefined;
};
type AccountUpdate = {
  creditorName: string;
  changeType:
    | 'NEW_ACCOUNT'
    | 'BALANCE_CHANGED'
    | 'LIMIT_CHANGED'
    | 'ACCOUNT_CLOSED'
    | 'NOT_MINE'
    | 'AUTHORIZED_USER_CHANGED'
    | 'PROMOTIONAL_OFFER_CHANGED';
  balance?: number | undefined;
  creditLimit?: number | undefined;
  effectiveDate?: string | undefined;
};
type CreditAccountReview = {
  cardId?: string | undefined;
  status: 'CONFIRMED' | 'UPDATED' | 'NEW';
  cardName: string;
  issuer: string;
  scope: 'PERSONAL' | 'BUSINESS';
  accountStatus: 'OPEN' | 'CLOSED';
  balance?: number | undefined;
  creditLimit?: number | undefined;
};

function ScoreTrendChart({ reviews }: { reviews: Review[] }) {
  const [activeBureau, setActiveBureau] =
    useState<(typeof bureauSeries)[number]['key']>('experianScore');
  const points = [...reviews].filter((review) => review.snapshot && review.completedAt).reverse();
  if (points.length === 0) return null;
  const width = 760;
  const height = 230;
  const plot = { left: 46, right: 18, top: 18, bottom: 42 };
  const x = (index: number) =>
    points.length === 1
      ? width / 2
      : plot.left + (index * (width - plot.left - plot.right)) / (points.length - 1);
  const y = (score: number) => plot.top + ((850 - score) / 550) * (height - plot.top - plot.bottom);
  const bureau = bureauSeries.find((item) => item.key === activeBureau)!;
  const available = points
    .map((review, index) => ({ index, score: review.snapshot?.[activeBureau] ?? null }))
    .filter((item): item is { index: number; score: number } => item.score != null);
  const linePoints = available.map((item) => `${x(item.index)},${y(item.score)}`).join(' ');
  const areaPoints = available.length
    ? `${x(available[0]!.index)},${height - plot.bottom} ${linePoints} ${x(available[available.length - 1]!.index)},${height - plot.bottom}`
    : '';

  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={activeBureau}
        onChange={(_, value) => value && setActiveBureau(value)}
        aria-label="Credit bureau score"
        sx={{ mb: 2 }}
      >
        {bureauSeries.map((item) => (
          <ToggleButton
            key={item.key}
            value={item.key}
            sx={{
              py: 1.25,
              '&.Mui-selected': {
                color: 'common.white',
                bgcolor: `${item.color}22`,
                boxShadow: `inset 0 0 0 1px ${item.color}, 0 0 24px ${item.color}25`,
              },
            }}
          >
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Box
          component="svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Credit score history by bureau"
          sx={{ display: 'block', width: '100%', minWidth: points.length > 5 ? 620 : 0 }}
        >
          <defs>
            <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bureau.color} stopOpacity="0.46" />
              <stop offset="100%" stopColor={bureau.color} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="scoreLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6f7cff" />
              <stop offset="50%" stopColor={bureau.color} />
              <stop offset="100%" stopColor="#45f0c1" />
            </linearGradient>
            <filter id="scoreGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[300, 500, 700, 850].map((tick) => (
            <g key={tick}>
              <line
                x1={plot.left}
                x2={width - plot.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(174, 196, 230, .16)"
              />
              <text x={plot.left - 8} y={y(tick) + 4} textAnchor="end" fill="#91a1ba" fontSize="12">
                {tick}
              </text>
            </g>
          ))}
          {available.length > 1 && <polygon points={areaPoints} fill="url(#scoreAreaGradient)" />}
          {available.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="url(#scoreLineGradient)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#scoreGlow)"
            />
          )}
          {available.map((item) => (
            <g key={item.index}>
              <circle
                cx={x(item.index)}
                cy={y(item.score)}
                r="7"
                fill={bureau.color}
                opacity=".22"
              />
              <circle
                cx={x(item.index)}
                cy={y(item.score)}
                r="4"
                fill="#fff"
                stroke={bureau.color}
                strokeWidth="3"
              />
              <text
                x={x(item.index)}
                y={y(item.score) - 13}
                textAnchor="middle"
                fill={bureau.color}
                fontSize="13"
                fontWeight="800"
              >
                {item.score}
              </text>
            </g>
          ))}
          {points.map((review, index) => (
            <text
              key={review.id}
              x={x(index)}
              y={height - 12}
              textAnchor="middle"
              fill="#91a1ba"
              fontSize="12"
            >
              {new Date(review.completedAt!).toLocaleDateString(undefined, {
                month: 'short',
                year: '2-digit',
              })}
            </text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function ScoreMeter({
  label,
  score,
  color,
}: {
  label: string;
  score: number | null;
  color: string;
}) {
  const position = score == null ? 0 : Math.max(0, Math.min(100, ((score - 300) / 550) * 100));
  return (
    <SectionCard>
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography sx={{ fontWeight: 850 }}>{label}</Typography>
          <Typography variant="h2" sx={{ color, textShadow: `0 0 22px ${color}55` }}>
            {score ?? '—'}
          </Typography>
        </Stack>
        <Box sx={{ position: 'relative', pt: 1.5 }}>
          {score != null && (
            <Box
              sx={{
                position: 'absolute',
                left: `${position}%`,
                top: 0,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: 'common.white',
                border: `3px solid ${color}`,
                boxShadow: `0 0 16px ${color}`,
                transform: 'translateX(-50%)',
                zIndex: 1,
              }}
            />
          )}
          <Box
            sx={{
              height: 12,
              borderRadius: 99,
              background:
                'linear-gradient(90deg, #ff5f78 0%, #ffb34d 34%, #46d8ef 68%, #42e6a4 100%)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,.35), 0 0 20px rgba(69,215,240,.16)',
            }}
          />
        </Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            300 · Lowest
          </Typography>
          <Typography variant="caption" color="text.secondary">
            850 · Highest
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {score == null ? 'Not recorded for this Review' : 'Score recorded for this Review'}
        </Typography>
      </Stack>
    </SectionCard>
  );
}

type ProfileChange = {
  title: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
};

function calculateProfileChanges(
  current: NonNullable<Review['snapshot']>,
  previous: NonNullable<Review['snapshot']>,
): ProfileChange[] {
  const changes: ProfileChange[] = [];
  const scoreChanges = bureauSeries.flatMap((bureau) => {
    const currentScore = current[bureau.key];
    const previousScore = previous[bureau.key];
    return currentScore == null || previousScore == null
      ? []
      : [{ label: bureau.label, delta: currentScore - previousScore }];
  });
  if (scoreChanges.length > 0) {
    const allUp = scoreChanges.every((item) => item.delta > 0);
    const allDown = scoreChanges.every((item) => item.delta < 0);
    const total = scoreChanges.reduce((sum, item) => sum + item.delta, 0);
    changes.push({
      title: allUp
        ? 'Scores increased across all reported bureaus'
        : allDown
          ? 'Scores decreased across all reported bureaus'
          : 'Bureau scores changed since the previous Review',
      detail: scoreChanges
        .map((item) => `${item.label} ${item.delta > 0 ? '+' : ''}${item.delta}`)
        .join(' · '),
      tone: total > 0 ? 'positive' : total < 0 ? 'negative' : 'neutral',
    });
  }
  if (
    current.aggregateUtilization != null &&
    previous.aggregateUtilization != null &&
    current.aggregateUtilization !== previous.aggregateUtilization
  ) {
    const delta = current.aggregateUtilization - previous.aggregateUtilization;
    changes.push({
      title: `Utilization ${delta < 0 ? 'decreased' : 'increased'} from ${previous.aggregateUtilization}% to ${current.aggregateUtilization}%`,
      detail: `${Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 1)} percentage-point change`,
      tone: delta < 0 ? 'positive' : 'negative',
    });
  }
  if (
    current.recentInquiries != null &&
    previous.recentInquiries != null &&
    current.recentInquiries !== previous.recentInquiries
  ) {
    const delta = current.recentInquiries - previous.recentInquiries;
    changes.push({
      title:
        delta < 0
          ? `${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'inquiry no longer appears' : 'inquiries no longer appear'} in the tracked recent count`
          : `${delta} new ${delta === 1 ? 'inquiry appears' : 'inquiries appear'} in the tracked recent count`,
      detail: `${previous.recentInquiries} previously · ${current.recentInquiries} currently`,
      tone: delta < 0 ? 'positive' : 'negative',
    });
  }
  const currentAvailable =
    current.revolvingLimit == null || current.revolvingBalance == null
      ? null
      : current.revolvingLimit - current.revolvingBalance;
  const previousAvailable =
    previous.revolvingLimit == null || previous.revolvingBalance == null
      ? null
      : previous.revolvingLimit - previous.revolvingBalance;
  if (
    currentAvailable != null &&
    previousAvailable != null &&
    currentAvailable !== previousAvailable
  ) {
    const delta = currentAvailable - previousAvailable;
    changes.push({
      title: `Available revolving credit ${delta > 0 ? 'increased' : 'decreased'} by $${Math.abs(delta).toLocaleString()}`,
      detail: `$${previousAvailable.toLocaleString()} previously · $${currentAvailable.toLocaleString()} currently`,
      tone: delta > 0 ? 'positive' : 'negative',
    });
  }
  return changes;
}

export function SecureReportViewer({
  documentId,
  contentPath,
}: {
  documentId: string;
  contentPath?: string;
}) {
  const query = useQuery({
    queryKey: ['credit-report-content', documentId],
    queryFn: () =>
      apiBlobRequest(contentPath ?? `/api/v1/reviews/report-documents/${documentId}/content`),
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">{query.error.message}</Alert>;
  if (!objectUrl) return null;
  return (
    <Box
      component="iframe"
      title="Uploaded credit report"
      src={objectUrl}
      sx={{
        width: '100%',
        height: { xs: 520, lg: 760 },
        border: 0,
        borderRadius: 2,
        bgcolor: 'common.white',
      }}
    />
  );
}

function CreditProfilePageContent({ v2 = false }: { v2?: boolean }) {
  const showLegacyProfileDetails = false;
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportChangeOpen, setReportChangeOpen] = useState(false);
  const [reportChangeType, setReportChangeType] = useState('BALANCE_OR_LIMIT');
  const [reportChangeDetails, setReportChangeDetails] = useState('');
  const [reportChangeSubmitted, setReportChangeSubmitted] = useState(false);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const fullScreenReportViewer = useMediaQuery(theme.breakpoints.down('sm'));
  const previewDocumentsQuery = useQuery({
    queryKey: ['client-documents'],
    queryFn: () =>
      apiRequest<{
        documents: Array<{
          id: string;
          originalFileName: string;
          mimeType: string;
          sizeBytes: number;
          uploadedAt: string;
        }>;
      }>('/api/v1/reviews/report-documents/client'),
  });
  const profileChangesQuery = useQuery({
    queryKey: ['support-cases'],
    queryFn: () =>
      apiRequest<{
        cases: Array<{ id: string; category: string; status: string; subject: string }>;
      }>('/api/v1/client/support-cases'),
    enabled: v2,
  });
  const reportChangeMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/client/support-cases', {
        method: 'POST',
        body: JSON.stringify({
          category: 'CREDIT_REVIEW',
          priority: 'NORMAL',
          subject: `Credit Profile change: ${reportChangeType.replaceAll('_', ' ').toLowerCase()}`,
          message: reportChangeDetails,
        }),
      }),
    onSuccess: async () => {
      setReportChangeOpen(false);
      setReportChangeDetails('');
      setReportChangeSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: ['support-cases'] });
    },
  });
  const activeReviewQuery = useQuery({
    queryKey: ['review'],
    queryFn: () => apiRequest<{ review: Review | null }>('/api/v1/reviews/client'),
    retry: false,
  });
  const query = useQuery({
    queryKey: ['credit-profile'],
    queryFn: () =>
      apiRequest<{
        profile: {
          generalReadiness: string;
          review: Review | null;
          history: Review[];
          actions: Array<{
            id: string;
            title: string;
            description: string | null;
            status: string;
            dueAt: string | null;
          }>;
          freshness: { asOf: string | null; expiresAt: string | null; isCurrent: boolean };
        };
      }>('/api/v1/client/credit-profile'),
    retry: false,
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load your Credit Profile.</Alert>;
  const {
    review: storedReview,
    generalReadiness: storedReadiness,
    history: storedHistory,
    freshness: storedFreshness,
    actions,
  } = query.data!.profile;
  const previewDocuments = previewDocumentsQuery.data?.documents ?? [];
  const previewIntake = (index: number): Review['intake'] => {
    const document = previewDocuments[index];
    return document
      ? {
          reportDocumentKey: null,
          reportSource: 'Sample report history',
          reportDate: document.uploadedAt,
          reportDocument: document,
        }
      : null;
  };
  const previewReview: Review = {
    id: 'credit-profile-preview',
    status: 'COMPLETE',
    generalReadiness: 'MEDIUM',
    recommendation: 'PREPARE_FIRST',
    readinessExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
    nextReviewRecommendedAt: new Date(Date.now() + 90 * 86400000).toISOString(),
    completedAt: new Date().toISOString(),
    clientSummary:
      'Your profile has a solid payment foundation. Reducing revolving utilization and allowing recent inquiries to age should improve readiness for the next application phase.',
    intake: previewIntake(0),
    findings: [
      { id: 'preview-1', label: 'Strong payment history', severity: 'POSITIVE', description: null },
      {
        id: 'preview-2',
        label: 'Utilization needs preparation',
        severity: 'CAUTION',
        description: null,
      },
      { id: 'preview-3', label: 'Recent inquiry activity', severity: 'CAUTION', description: null },
    ],
    snapshot: {
      capturedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      source: 'Sample three-bureau report',
      experianScore: 718,
      equifaxScore: 711,
      transunionScore: 724,
      aggregateUtilization: 38,
      revolvingBalance: 15200,
      revolvingLimit: 40000,
      openAccounts: 8,
      recentInquiries: 3,
      derogatoryItems: 0,
      averageAccountAgeMonths: 62,
      oldestAccountAgeMonths: 118,
      revolvingAccounts: 6,
      installmentAccounts: 2,
      latePayments: 0,
      collections: 0,
      chargeOffs: 0,
      bankruptcies: 0,
      scoreModel: 'VantageScore 3.0',
      accounts: [
        {
          id: 'preview-account-1',
          creditorName: 'Example Bank',
          accountType: 'Revolving card',
          creditLimit: 15000,
          balance: 9300,
          paymentStatus: 'Pays as agreed',
          isOpen: true,
        },
        {
          id: 'preview-account-2',
          creditorName: 'Sample Credit Union',
          accountType: 'Revolving card',
          creditLimit: 12000,
          balance: 5900,
          paymentStatus: 'Pays as agreed',
          isOpen: true,
        },
        {
          id: 'preview-account-3',
          creditorName: 'Illustrative Auto Finance',
          accountType: 'Installment loan',
          creditLimit: null,
          balance: 18750,
          paymentStatus: 'Pays as agreed',
          isOpen: true,
        },
      ],
    },
  };
  const previewHistory: Review[] = [
    previewReview,
    ...[
      {
        id: 'credit-profile-preview-1b',
        monthsAgo: 1,
        readiness: 'MEDIUM',
        recommendation: 'PREPARE_FIRST',
        summary:
          'Scores were strengthening, while lower utilization and fewer recent inquiries supported continued preparation.',
        scores: [710, 708, 720],
        utilization: 34,
        revolvingBalance: 13600,
        inquiries: 2,
      },
      {
        id: 'credit-profile-preview-2',
        monthsAgo: 3,
        readiness: 'MEDIUM',
        recommendation: 'PREPARE_FIRST',
        summary:
          'Utilization improved after targeted paydowns. Continue lowering balances and avoid new inquiries before the next application phase.',
        scores: [697, 691, 704],
        utilization: 46,
        revolvingBalance: 18400,
        inquiries: 4,
      },
      {
        id: 'credit-profile-preview-3',
        monthsAgo: 6,
        readiness: 'LOW',
        recommendation: 'WAIT',
        summary:
          'Recent inquiry activity and elevated revolving utilization made waiting the strongest next step at this Review.',
        scores: [672, 665, 680],
        utilization: 58,
        revolvingBalance: 23200,
        inquiries: 6,
      },
      {
        id: 'credit-profile-preview-4',
        monthsAgo: 9,
        readiness: 'LOW',
        recommendation: 'WAIT',
        summary:
          'The initial Review established a baseline and prioritized balance reduction, on-time payments, and a pause on new applications.',
        scores: [648, 641, 655],
        utilization: 71,
        revolvingBalance: 28400,
        inquiries: 7,
      },
    ].map((sample, sampleIndex) => {
      const completedAt = new Date();
      completedAt.setMonth(completedAt.getMonth() - sample.monthsAgo);
      const expiresAt = new Date(completedAt);
      expiresAt.setMonth(expiresAt.getMonth() + 3);
      return {
        ...previewReview,
        id: sample.id,
        generalReadiness: sample.readiness,
        recommendation: sample.recommendation,
        completedAt: completedAt.toISOString(),
        readinessExpiresAt: expiresAt.toISOString(),
        nextReviewRecommendedAt: expiresAt.toISOString(),
        clientSummary: sample.summary,
        intake: previewIntake(sampleIndex + 1),
        findings: [
          {
            id: `${sample.id}-finding-1`,
            label: 'Revolving utilization',
            severity: sample.utilization > 50 ? 'CRITICAL' : 'CAUTION',
            description: null,
          },
          {
            id: `${sample.id}-finding-2`,
            label: 'Recent inquiry activity',
            severity: 'CAUTION',
            description: null,
          },
        ],
        snapshot: {
          ...previewReview.snapshot!,
          capturedAt: completedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          experianScore: sample.scores[0]!,
          equifaxScore: sample.scores[1]!,
          transunionScore: sample.scores[2]!,
          aggregateUtilization: sample.utilization,
          revolvingBalance: sample.revolvingBalance,
          recentInquiries: sample.inquiries,
        },
      } satisfies Review;
    }),
  ];
  const currentReview = storedReview ?? previewReview;
  const history = storedReview ? storedHistory : previewHistory;
  const review = history.find((item) => item.id === selectedReviewId) ?? currentReview;
  const selectedReviewIndex = Math.max(
    0,
    history.findIndex((item) => item.id === review?.id),
  );
  const isCurrentReview = review?.id === currentReview?.id;
  const generalReadiness =
    !isCurrentReview && review
      ? review.generalReadiness
      : storedReview
        ? storedReadiness
        : 'MEDIUM';
  const freshness = storedReview
    ? storedFreshness
    : {
        asOf: previewReview.snapshot!.capturedAt,
        expiresAt: previewReview.readinessExpiresAt,
        isCurrent: true,
      };
  const decisionLabel =
    generalReadiness === 'HIGH'
      ? 'Ready for Application Round'
      : generalReadiness === 'MEDIUM'
        ? 'Action Needed First'
        : generalReadiness === 'LOW'
          ? 'Not Ready — Wait'
          : generalReadiness.replaceAll('_', ' ');
  const displayedActions = !isCurrentReview
    ? []
    : !storedReview
      ? [
          {
            id: 'preview-action-1',
            title: 'Pay down revolving balances',
            description: 'Target aggregate utilization below 30%.',
            status: 'READY',
            dueAt: null,
          },
          {
            id: 'preview-action-2',
            title: 'Allow inquiries to age',
            description: 'Avoid new applications for 90 days.',
            status: 'READY',
            dueAt: null,
          },
        ]
      : actions;
  if (!review?.snapshot)
    return (
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Review and readiness"
          title="Credit Profile"
          description="Your report, consultant decision, required actions, and Review history in one place."
        />
        <Alert severity="warning">
          This Review does not contain a completed Credit Profile snapshot. Open the Review to
          finish processing it.
        </Alert>
        {activeReviewQuery.data?.review && (
          <Button component={Link} to="/app/credit-center/review" variant="contained">
            Open Review
          </Button>
        )}
      </Stack>
    );
  const snapshot = review.snapshot;
  const previousSnapshot = history[selectedReviewIndex + 1]?.snapshot ?? null;
  const profileChanges = previousSnapshot
    ? calculateProfileChanges(snapshot, previousSnapshot)
    : [];
  const score = snapshot.experianScore ?? snapshot.equifaxScore ?? snapshot.transunionScore;
  const formatMoney = (value: number | null) =>
    value == null ? 'Not reported' : `$${value.toLocaleString()}`;
  const bureauCoverage = bureauSeries.filter((bureau) => snapshot[bureau.key] != null);
  const highestUtilizationAccount = snapshot.accounts.reduce<{
    name: string;
    utilization: number;
  } | null>((highest, account) => {
    if (account.balance == null || !account.creditLimit) return highest;
    const utilization = Math.round((account.balance / account.creditLimit) * 100);
    return !highest || utilization > highest.utilization
      ? { name: account.creditorName, utilization }
      : highest;
  }, null);
  const oldestAccountLabel =
    snapshot.oldestAccountAgeMonths == null
      ? 'Not reported'
      : `${Math.floor(snapshot.oldestAccountAgeMonths / 12)}y ${snapshot.oldestAccountAgeMonths % 12}m`;
  const reportDate = review.intake?.reportDate ?? review.intake?.reportDocument?.uploadedAt ?? null;
  const profileUpdateUnderReview =
    reportChangeSubmitted ||
    Boolean(
      profileChangesQuery.data?.cases.some(
        (supportCase) =>
          supportCase.category === 'CREDIT_REVIEW' &&
          supportCase.status !== 'RESOLVED' &&
          supportCase.subject.startsWith('Credit Profile change:'),
      ),
    );
  const availableRevolvingCredit =
    snapshot.revolvingLimit == null || snapshot.revolvingBalance == null
      ? null
      : snapshot.revolvingLimit - snapshot.revolvingBalance;
  const negativeItemCounts = [snapshot.collections, snapshot.chargeOffs, snapshot.bankruptcies];
  const negativeItemsReported = negativeItemCounts.some((value) => value != null);
  const totalNegativeItems = negativeItemsReported
    ? negativeItemCounts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const creditDetailCategories = [
    {
      title: 'Balances & utilization',
      icon: <AccountBalanceWalletRounded />,
      color: '#45d7f0',
      value:
        snapshot.revolvingBalance == null || snapshot.revolvingLimit == null
          ? 'Not reported'
          : `${formatMoney(snapshot.revolvingBalance)} of ${formatMoney(snapshot.revolvingLimit)}`,
      detail:
        snapshot.aggregateUtilization == null
          ? 'Utilization not reported'
          : `${snapshot.aggregateUtilization}% utilization${availableRevolvingCredit == null ? '' : ` · ${formatMoney(availableRevolvingCredit)} available`}`,
    },
    {
      title: 'Payment history',
      icon: <PaymentsRounded />,
      color: '#42e6a4',
      value:
        snapshot.latePayments == null
          ? 'Not reported'
          : snapshot.latePayments === 0
            ? 'No late payments recorded'
            : `${snapshot.latePayments} late ${snapshot.latePayments === 1 ? 'payment' : 'payments'} recorded`,
      detail: 'Based on the report used for this Review',
    },
    {
      title: 'Account age & mix',
      icon: <HistoryRounded />,
      color: '#8d7cff',
      value:
        snapshot.averageAccountAgeMonths == null
          ? 'Average age not reported'
          : `${Math.floor(snapshot.averageAccountAgeMonths / 12)}y ${snapshot.averageAccountAgeMonths % 12}m average age`,
      detail:
        snapshot.revolvingAccounts == null && snapshot.installmentAccounts == null
          ? 'Account mix not reported'
          : `${snapshot.revolvingAccounts ?? 0} revolving · ${snapshot.installmentAccounts ?? 0} installment`,
    },
    {
      title: 'Inquiries',
      icon: <SearchRounded />,
      color: '#ffb34d',
      value:
        snapshot.recentInquiries == null
          ? 'Not reported'
          : `${snapshot.recentInquiries} recent ${snapshot.recentInquiries === 1 ? 'inquiry' : 'inquiries'}`,
      detail: 'Tracked inquiry count at this Review',
    },
    {
      title: 'Negative items',
      icon: <WarningAmberRounded />,
      color: '#ff647c',
      value:
        totalNegativeItems == null
          ? 'Not reported'
          : totalNegativeItems === 0
            ? 'None recorded'
            : `${totalNegativeItems} ${totalNegativeItems === 1 ? 'item' : 'items'} recorded`,
      detail:
        totalNegativeItems == null
          ? 'Collections, charge-offs, and bankruptcies'
          : `${snapshot.collections ?? 0} collections · ${snapshot.chargeOffs ?? 0} charge-offs · ${snapshot.bankruptcies ?? 0} bankruptcies`,
    },
    {
      title: 'Report source',
      icon: <DescriptionRounded />,
      color: '#45d7f0',
      value: snapshot.source ?? review.intake?.reportSource ?? 'Not reported',
      detail: `${snapshot.scoreModel ?? 'Score model not reported'} · ${review.intake?.reportDate ? new Date(review.intake.reportDate).toLocaleDateString() : new Date(snapshot.capturedAt).toLocaleDateString()}`,
    },
  ];
  const dataLimitations = [
    snapshot.aggregateUtilization == null && 'Overall utilization was not verified.',
    snapshot.latePayments == null && 'Detailed payment-history counts were not captured.',
    snapshot.averageAccountAgeMonths == null && 'Account-age information was not captured.',
    snapshot.recentInquiries == null && 'Recent inquiry count was not captured.',
    totalNegativeItems == null && 'Negative-item categories were not captured separately.',
    !snapshot.scoreModel && 'The score model was not identified.',
  ].filter((item): item is string => Boolean(item));
  const utilizationStatus =
    snapshot.aggregateUtilization == null
      ? 'NOT_REPORTED'
      : snapshot.aggregateUtilization <= 10
        ? 'STRONG'
        : snapshot.aggregateUtilization <= 30
          ? 'STABLE'
          : snapshot.aggregateUtilization <= 50
            ? 'WATCH'
            : 'NEEDS_ACTION';
  const factorCards = [
    {
      label: 'Payment history',
      status:
        snapshot.derogatoryItems == null
          ? 'NOT_REPORTED'
          : snapshot.derogatoryItems === 0
            ? 'STRONG'
            : 'NEEDS_ACTION',
      fact:
        snapshot.derogatoryItems == null
          ? 'Derogatory information was not reported.'
          : snapshot.derogatoryItems === 0
            ? 'No derogatory items were recorded in this snapshot.'
            : `${snapshot.derogatoryItems} derogatory ${snapshot.derogatoryItems === 1 ? 'item requires' : 'items require'} attention.`,
    },
    {
      label: 'Revolving utilization',
      status: utilizationStatus,
      fact:
        snapshot.aggregateUtilization == null
          ? 'Aggregate utilization was not reported.'
          : `${snapshot.aggregateUtilization}% across ${formatMoney(snapshot.revolvingLimit)} in reported limits.`,
    },
    {
      label: 'Account age',
      status:
        snapshot.averageAccountAgeMonths == null
          ? 'NOT_REPORTED'
          : snapshot.averageAccountAgeMonths >= 84
            ? 'STRONG'
            : snapshot.averageAccountAgeMonths >= 36
              ? 'STABLE'
              : 'WATCH',
      fact:
        snapshot.averageAccountAgeMonths == null
          ? 'Average account age was not reported.'
          : `Average reported age is ${Math.floor(snapshot.averageAccountAgeMonths / 12)} years and ${snapshot.averageAccountAgeMonths % 12} months.`,
    },
    {
      label: 'Recent inquiries',
      status:
        snapshot.recentInquiries == null
          ? 'NOT_REPORTED'
          : snapshot.recentInquiries === 0
            ? 'STRONG'
            : snapshot.recentInquiries <= 2
              ? 'STABLE'
              : 'WATCH',
      fact:
        snapshot.recentInquiries == null
          ? 'Recent inquiry activity was not reported.'
          : `${snapshot.recentInquiries} recent ${snapshot.recentInquiries === 1 ? 'inquiry was' : 'inquiries were'} recorded.`,
    },
  ];
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={v2 ? 'Verified credit profile' : 'Review and readiness'}
        title="Credit Profile"
        description={
          v2
            ? 'Your scores, report facts, automatic changes, source document, and Review history.'
            : 'Your report, consultant decision, required actions, and Review history in one place.'
        }
      />
      {!isCurrentReview && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" onClick={() => setSelectedReviewId(currentReview?.id ?? null)}>
              Return to current
            </Button>
          }
        >
          Viewing the historical Review completed{' '}
          {review.completedAt ? new Date(review.completedAt).toLocaleDateString() : ''}. The details
          below are preserved from that Review.
        </Alert>
      )}
      <SectionCard variant="elevated">
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Profile freshness
              </Typography>
              <Chip
                size="small"
                color={
                  profileUpdateUnderReview ? 'warning' : freshness.isCurrent ? 'success' : 'warning'
                }
                label={
                  profileUpdateUnderReview
                    ? 'Update under review'
                    : freshness.isCurrent
                      ? 'Current'
                      : 'Expired'
                }
              />
            </Stack>
            <Typography variant="h3">
              {profileUpdateUnderReview
                ? 'Your Credit Profile update is under review'
                : freshness.isCurrent
                  ? 'Your Credit Profile is current'
                  : 'Your Credit Profile needs an update'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {profileUpdateUnderReview
                ? 'Your consultant is reviewing a reported change. Verified profile facts remain unchanged until review is complete.'
                : freshness.isCurrent
                  ? 'No update is needed until the current Review period ends.'
                  : 'Complete a new Credit Profile Review before beginning another credit application service.'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Profile as of
            </Typography>
            <Typography sx={{ fontWeight: 850, mt: 0.35 }}>
              {freshness.asOf ? new Date(freshness.asOf).toLocaleDateString() : '—'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Current through
            </Typography>
            <Typography sx={{ fontWeight: 850, mt: 0.35 }}>
              {freshness.expiresAt ? new Date(freshness.expiresAt).toLocaleDateString() : '—'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              component={Link}
              to="/app/credit-center/review"
              variant="contained"
              fullWidth
              disabled={freshness.isCurrent || profileUpdateUnderReview}
            >
              Update Credit Profile
            </Button>
            {(freshness.isCurrent || profileUpdateUnderReview) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
              >
                {profileUpdateUnderReview
                  ? 'Awaiting consultant review'
                  : 'Available after expiration'}
              </Typography>
            )}
          </Grid>
        </Grid>
      </SectionCard>
      <Box>
        <Typography variant="overline" color="primary">
          Credit profile
        </Typography>
        <Typography variant="h2">Score information</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Bureau scores for the selected Review and how they have changed over time.
        </Typography>
      </Box>
      {history.length > 0 && (
        <SectionCard>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h3">Score history</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Switch bureaus to compare the score recorded at every completed Review.
              </Typography>
            </Box>
            <ScoreTrendChart reviews={history} />
            <Box
              aria-label="Review history navigator"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '48px 1fr 48px', sm: '140px 1fr 140px' },
                alignItems: 'stretch',
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: 'rgba(5, 13, 29, .34)',
              }}
            >
              <Button
                variant="text"
                disabled={selectedReviewIndex >= history.length - 1}
                startIcon={<ChevronLeftRounded />}
                onClick={() => setSelectedReviewId(history[selectedReviewIndex + 1]!.id)}
                aria-label="View older Review"
                sx={{
                  minWidth: 0,
                  borderRadius: 0,
                  '& .MuiButton-startIcon': { m: { xs: 0, sm: 0.5 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Older
                </Box>
              </Button>
              <Stack
                sx={{
                  px: 2,
                  py: 1.5,
                  textAlign: 'center',
                  justifyContent: 'center',
                  borderInline: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {selectedReviewIndex === 0 ? 'CURRENT REVIEW' : 'HISTORICAL REVIEW'} ·{' '}
                  {selectedReviewIndex + 1} OF {history.length}
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {review?.completedAt
                    ? new Date(review.completedAt).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Completed Review'}
                </Typography>
              </Stack>
              <Button
                variant="text"
                disabled={selectedReviewIndex === 0}
                endIcon={<ChevronRightRounded />}
                onClick={() => setSelectedReviewId(history[selectedReviewIndex - 1]!.id)}
                aria-label="View newer Review"
                sx={{
                  minWidth: 0,
                  borderRadius: 0,
                  '& .MuiButton-endIcon': { m: { xs: 0, sm: 0.5 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Newer
                </Box>
              </Button>
            </Box>
          </Stack>
        </SectionCard>
      )}
      <Grid container spacing={2}>
        {bureauSeries.map((bureau) => (
          <Grid key={bureau.key} size={{ xs: 12, sm: 4 }}>
            <ScoreMeter label={bureau.label} score={snapshot[bureau.key]} color={bureau.color} />
          </Grid>
        ))}
      </Grid>
      {v2 && (
        <SectionCard
          variant="elevated"
          sx={{
            background:
              'linear-gradient(125deg, rgba(24, 49, 84, .96) 0%, rgba(17, 34, 64, .98) 100%)',
            borderColor: 'rgba(69, 215, 240, .38)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, .22)',
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 2,
                  color: '#07111f',
                  background: 'linear-gradient(135deg, #45d7f0, #8d7cff)',
                  border: '1px solid rgba(255, 255, 255, .32)',
                  boxShadow: '0 0 20px rgba(69, 215, 240, .3)',
                }}
              >
                <InsightsRounded />
              </Box>
              <Box>
                <Typography variant="h3">Profile change summary</Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatically compared with the immediately previous completed Review.
                </Typography>
              </Box>
            </Stack>
            {!previousSnapshot ? (
              <Typography color="text.secondary">
                This is the earliest available Review, so there is no previous profile to compare.
              </Typography>
            ) : profileChanges.length === 0 ? (
              <Typography color="text.secondary">
                No tracked profile changes were recorded between these Reviews.
              </Typography>
            ) : (
              <Grid container spacing={1.25}>
                {profileChanges.map((change) => {
                  const color =
                    change.tone === 'positive'
                      ? '#42e6a4'
                      : change.tone === 'negative'
                        ? '#ff647c'
                        : '#45d7f0';
                  return (
                    <Grid key={change.title} size={{ xs: 12, md: 6 }}>
                      <Box
                        sx={{
                          height: '100%',
                          p: 1.65,
                          borderRadius: 1.75,
                          border: '1px solid',
                          borderColor: `${color}70`,
                          background: `linear-gradient(110deg, ${color}12 0%, rgba(7, 20, 40, .48) 100%)`,
                          boxShadow: `inset 3px 0 0 ${color}`,
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
                        >
                          <Typography sx={{ fontWeight: 900, color: 'common.white' }}>
                            {change.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={
                              change.tone === 'positive'
                                ? 'Improved'
                                : change.tone === 'negative'
                                  ? 'Declined'
                                  : 'Changed'
                            }
                            sx={{
                              flexShrink: 0,
                              color,
                              bgcolor: `${color}18`,
                              border: `1px solid ${color}70`,
                              fontWeight: 850,
                            }}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.65, color: 'rgba(232, 241, 255, .82)' }}
                        >
                          {change.detail}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Stack>
        </SectionCard>
      )}
      {showLegacyProfileDetails && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard
              label="Credit score"
              value={score?.toString() ?? '—'}
              supportingText="Latest reported score"
              accent="gradient"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard
              label="Utilization"
              value={
                snapshot.aggregateUtilization == null ? '—' : `${snapshot.aggregateUtilization}%`
              }
              supportingText={`$${(snapshot.revolvingBalance ?? 0).toLocaleString()} of $${(snapshot.revolvingLimit ?? 0).toLocaleString()}`}
              accent="info"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard
              label="Open accounts"
              value={snapshot.openAccounts?.toString() ?? '—'}
              supportingText={`${snapshot.recentInquiries ?? 0} recent inquiries`}
              accent="positive"
            />
          </Grid>
        </Grid>
      )}
      <Box>
        <Typography variant="overline" color="primary">
          Credit profile
        </Typography>
        <Typography variant="h2">Report information</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Neutral facts recorded from the credit report used for this Review.
        </Typography>
      </Box>
      {!v2 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Utilization"
              value={
                snapshot.aggregateUtilization == null ? '—' : `${snapshot.aggregateUtilization}%`
              }
              supportingText="Reported revolving utilization"
              accent="gradient"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Revolving balance"
              value={formatMoney(snapshot.revolvingBalance)}
              supportingText={`Across ${formatMoney(snapshot.revolvingLimit)} in limits`}
              accent="info"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Open accounts"
              value={snapshot.openAccounts?.toString() ?? '—'}
              supportingText="Reported open accounts"
              accent="positive"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Recent inquiries"
              value={snapshot.recentInquiries?.toString() ?? '—'}
              supportingText="Recorded in this Review"
              accent="info"
            />
          </Grid>
        </Grid>
      )}
      {v2 && (
        <Grid container spacing={1.5}>
          {creditDetailCategories.map((category) => (
            <Grid key={category.title} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Box
                sx={{
                  height: '100%',
                  p: 2,
                  border: 1,
                  borderColor: `${category.color}48`,
                  borderRadius: 2.5,
                  background: `linear-gradient(145deg, ${category.color}10 0%, rgba(5, 13, 29, .94) 72%)`,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 8px 20px rgba(0, 0, 0, .12), inset 3px 0 0 ${category.color}`,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1.5,
                      color: category.color,
                      bgcolor: `${category.color}12`,
                      border: `1px solid ${category.color}45`,
                      '& svg': { fontSize: 20 },
                    }}
                  >
                    {category.icon}
                  </Box>
                  <Typography variant="overline" sx={{ color: category.color }}>
                    {category.title}
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 950, mt: 1.35, color: 'common.white' }}>
                  {category.value}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1.25,
                    px: 1.25,
                    py: 0.9,
                    borderRadius: 1.5,
                    color: 'rgba(232, 241, 255, .78)',
                    bgcolor: 'rgba(2, 9, 22, .38)',
                  }}
                >
                  {category.detail}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      {v2 && (
        <SectionCard>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                color: 'primary.main',
                bgcolor: 'rgba(69, 215, 240, .1)',
                border: '1px solid rgba(69, 215, 240, .28)',
              }}
            >
              <InsightsRounded />
            </Box>
            <Box>
              <Typography variant="h3">Profile highlights</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.35 }}>
                High-signal details from the selected credit-report snapshot.
              </Typography>
            </Box>
          </Stack>
          <Grid container spacing={1.25}>
            {[
              {
                label: 'Highest utilization',
                value: highestUtilizationAccount
                  ? `${highestUtilizationAccount.utilization}%`
                  : 'Not reported',
                detail: highestUtilizationAccount?.name ?? 'No eligible revolving account',
                color: '#ffb34d',
              },
              {
                label: 'Oldest account',
                value: oldestAccountLabel,
                detail: 'Reported account age',
                color: '#8d7cff',
              },
              {
                label: 'Bureau coverage',
                value: `${bureauCoverage.length} of ${bureauSeries.length}`,
                detail:
                  bureauCoverage.length > 0
                    ? `${bureauCoverage.length === bureauSeries.length ? 'Full coverage' : 'Partial coverage'} · ${bureauCoverage.map((bureau) => bureau.label).join(' · ')}`
                    : 'No bureau scores reported',
                color: '#42e6a4',
              },
              {
                label: 'Score model',
                value: snapshot.scoreModel ?? 'Not reported',
                detail: 'Model recorded for this Review',
                color: '#45d7f0',
              },
            ].map((highlight) => (
              <Grid key={highlight.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Box
                  sx={{
                    height: '100%',
                    p: 1.6,
                    borderRadius: 1.75,
                    border: `1px solid ${highlight.color}42`,
                    background: `linear-gradient(120deg, ${highlight.color}0d, rgba(5, 14, 30, .62))`,
                    boxShadow: `inset 3px 0 0 ${highlight.color}`,
                  }}
                >
                  <Typography variant="overline" sx={{ color: highlight.color }}>
                    {highlight.label}
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 0.45 }}>
                    {highlight.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55 }}>
                    {highlight.detail}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      )}
      {v2 && (
        <SectionCard>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' } }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h3">Data limitations</Typography>
              {dataLimitations.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  No structured data limitations were recorded for this Review. Detailed tradeline
                  information remains available in the uploaded report.
                </Typography>
              ) : (
                <Stack spacing={0.65} sx={{ mt: 1 }}>
                  {dataLimitations.map((limitation) => (
                    <Typography key={limitation} variant="body2" color="text.secondary">
                      • {limitation}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Button variant="outlined" onClick={() => setReportChangeOpen(true)}>
              Report a change
            </Button>
          </Stack>
          {reportChangeSubmitted && (
            <Alert
              severity="success"
              sx={{ mt: 2 }}
              onClose={() => setReportChangeSubmitted(false)}
            >
              Your change was sent to the consultant for review.
            </Alert>
          )}
        </SectionCard>
      )}
      <SectionCard>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ justifyContent: 'space-between', gap: 1, mb: 2 }}
        >
          <Box>
            <Typography variant="h3">
              {isCurrentReview ? 'Credit report reviewed' : 'Historical credit report'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {review.intake?.reportDocument
                ? `The report used for the Review completed ${
                    review.completedAt ? new Date(review.completedAt).toLocaleDateString() : ''
                  }.`
                : `Report used for the Review completed ${
                    review.completedAt ? new Date(review.completedAt).toLocaleDateString() : ''
                  }`}
            </Typography>
          </Box>
          {isCurrentReview ? (
            <Box
              role="status"
              aria-label="Current report"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.9,
                alignSelf: 'flex-start',
                px: 1.25,
                py: 0.65,
                borderRadius: 99,
                color: '#42e6a4',
                bgcolor: 'rgba(66, 230, 164, .1)',
                border: '1px solid rgba(66, 230, 164, .4)',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#42e6a4',
                  boxShadow: '0 0 10px rgba(66, 230, 164, .8)',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    border: '1px solid rgba(66, 230, 164, .55)',
                    animation: 'currentReportPulse 2s ease-out infinite',
                  },
                  '@keyframes currentReportPulse': {
                    '0%': { transform: 'scale(.55)', opacity: 1 },
                    '75%, 100%': { transform: 'scale(1.6)', opacity: 0 },
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'inherit', fontWeight: 900, letterSpacing: '.04em' }}
              >
                CURRENT REPORT
              </Typography>
            </Box>
          ) : (
            <Chip label="Historical document" variant="outlined" />
          )}
        </Stack>
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                bgcolor: 'rgba(69, 215, 240, .06)',
                border: '1px solid rgba(69, 215, 240, .18)',
                boxShadow: 'inset 3px 0 0 rgba(69, 215, 240, .72)',
              }}
            >
              <Typography variant="overline" color="text.secondary">
                Report date
              </Typography>
              <Typography sx={{ fontWeight: 900, mt: 0.35 }}>
                {reportDate ? new Date(reportDate).toLocaleDateString() : 'Not reported'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Date of the credit-report data
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                bgcolor: 'rgba(141, 124, 255, .06)',
                border: '1px solid rgba(141, 124, 255, .18)',
                boxShadow: 'inset 3px 0 0 rgba(141, 124, 255, .72)',
              }}
            >
              <Typography variant="overline" color="text.secondary">
                Review completed
              </Typography>
              <Typography sx={{ fontWeight: 900, mt: 0.35 }}>
                {review.completedAt
                  ? new Date(review.completedAt).toLocaleDateString()
                  : 'Not completed'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Date the consultant completed the Review
              </Typography>
            </Box>
          </Grid>
        </Grid>
        {review.intake?.reportDocument ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              p: 2,
              alignItems: { sm: 'center' },
              border: 1,
              borderColor: 'divider',
              borderRadius: 2.5,
              bgcolor: 'rgba(8, 19, 39, .46)',
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                color: 'primary.main',
                bgcolor: 'rgba(69, 215, 240, .1)',
                border: '1px solid rgba(69, 215, 240, .28)',
              }}
            >
              <DescriptionRounded sx={{ fontSize: 30 }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>
                {review.intake.reportDocument.originalFileName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                PDF credit report · Uploaded{' '}
                {new Date(review.intake.reportDocument.uploadedAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<VisibilityRounded />}
              onClick={() => setReportViewerOpen(true)}
              sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
            >
              View report
            </Button>
          </Stack>
        ) : (
          <Alert severity="info">
            {!storedReview
              ? 'The visual preview does not include fictional credit-report files. A real completed Review displays the exact PDF uploaded for that Review here.'
              : 'No credit-report file is attached to this historical Review.'}
          </Alert>
        )}
      </SectionCard>
      <Dialog
        open={reportViewerOpen && Boolean(review.intake?.reportDocument)}
        onClose={() => setReportViewerOpen(false)}
        fullScreen={fullScreenReportViewer}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
      >
        {review.intake?.reportDocument && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <DescriptionRounded color="primary" />
                <Typography variant="h3" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                  {review.intake.reportDocument.originalFileName}
                </Typography>
                <IconButton
                  aria-label="Close credit report viewer"
                  onClick={() => setReportViewerOpen(false)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
              <SecureReportViewer
                key={`${review.id}-${review.intake.reportDocument.id}`}
                documentId={review.intake.reportDocument.id}
              />
            </DialogContent>
          </>
        )}
      </Dialog>
      {v2 && (
        <Dialog
          open={reportChangeOpen}
          onClose={() => setReportChangeOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <Typography variant="h3" sx={{ flex: 1 }}>
                Report a Credit Profile change
              </Typography>
              <IconButton aria-label="Close change form" onClick={() => setReportChangeOpen(false)}>
                <CloseRounded />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Typography color="text.secondary">
                Select what changed. Your consultant will review it before any Credit Profile facts
                or readiness guidance are updated.
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={reportChangeType}
                onChange={(_, value) => value && setReportChangeType(value)}
                aria-label="Reported change type"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: 1,
                  '& .MuiToggleButtonGroup-grouped': {
                    m: 0,
                    border: '1px solid !important',
                    borderColor: 'divider !important',
                    borderRadius: '12px !important',
                  },
                  '& .MuiToggleButtonGroup-grouped.Mui-selected': {
                    borderColor: 'primary.main !important',
                    boxShadow: '0 0 18px rgba(69, 215, 240, .14)',
                  },
                  '& .MuiToggleButtonGroup-grouped:last-of-type': {
                    gridColumn: { sm: '1 / -1' },
                  },
                }}
              >
                {(
                  [
                    ['BALANCE_OR_LIMIT', 'Balance or limit'],
                    ['NEW_APPLICATION', 'New application'],
                    ['NEW_ACCOUNT', 'New account'],
                    ['INACCURATE_INFORMATION', 'Incorrect information'],
                    ['OTHER', 'Other change'],
                  ] as const
                ).map(([value, label]) => (
                  <ToggleButton key={value} value={value}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <TextField
                label="What changed?"
                multiline
                minRows={4}
                value={reportChangeDetails}
                onChange={(event) => setReportChangeDetails(event.target.value)}
                placeholder="Include the account, amount, date, or correction your consultant should review."
              />
              {reportChangeMutation.isError && (
                <Alert severity="error">{reportChangeMutation.error.message}</Alert>
              )}
              <Stack
                direction={{ xs: 'column-reverse', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'flex-end' }}
              >
                <Button variant="text" onClick={() => setReportChangeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  disabled={reportChangeDetails.trim().length < 5 || reportChangeMutation.isPending}
                  onClick={() => reportChangeMutation.mutate()}
                >
                  {reportChangeMutation.isPending ? 'Sending…' : 'Send to consultant'}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </Dialog>
      )}
      {!v2 ? (
        <>
          <Box>
            <Typography variant="overline" color="primary">
              Consultant guidance
            </Typography>
            <Typography variant="h2">Review results</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Your consultant’s decision, explanation, and recommended next actions.
            </Typography>
          </Box>
          <SectionCard variant="elevated">
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" color="text.secondary">
                  Consultant decision
                </Typography>
                <Typography variant="h2" color="primary" sx={{ mt: 0.5 }}>
                  {decisionLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Based on the uploaded report and your current goals.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography variant="overline" color="text.secondary">
                  Consultant explanation
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {review.clientSummary ?? 'No client summary was recorded.'}
                </Typography>
              </Grid>
            </Grid>
          </SectionCard>
          <SectionCard variant="operational">
            <Typography variant="h3">Action plan</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              {isCurrentReview
                ? 'Complete these consultant-selected actions before the next application phase.'
                : 'Historical action details are preserved in the Review record.'}
            </Typography>
            {displayedActions.length === 0 ? (
              <Typography color="text.secondary">No required actions were assigned.</Typography>
            ) : (
              <Stack spacing={1}>
                {displayedActions.map((action) => (
                  <Stack
                    key={action.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      gap: 1,
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <CheckCircleRounded
                      color={action.status === 'COMPLETED' ? 'success' : 'disabled'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 850 }}>{action.title}</Typography>
                      {action.description && (
                        <Typography variant="body2" color="text.secondary">
                          {action.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="small" label={action.status.replaceAll('_', ' ')} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard variant="elevated">
          <Grid container spacing={2.5} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="overline" color="primary">
                Consultant guidance
              </Typography>
              <Typography variant="h2" sx={{ mt: 0.5 }}>
                Continue to Credit Readiness
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Credit Profile contains verified report facts only. Your consultant’s readiness
                decision, rationale, recommendations, action plan, timing, and goal guidance are
                available in Credit Readiness.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button component={Link} to="/app/readiness" variant="contained" fullWidth>
                View Credit Readiness
              </Button>
            </Grid>
          </Grid>
        </SectionCard>
      )}
      {showLegacyProfileDetails && (
        <>
          <Box>
            <Typography variant="h2">Credit factors</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              The verified facts that shaped your consultant’s recommendation.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {factorCards.map((factor) => {
              const color: 'success' | 'error' | 'warning' | 'default' =
                factor.status === 'STRONG'
                  ? 'success'
                  : factor.status === 'NEEDS_ACTION'
                    ? 'error'
                    : factor.status === 'WATCH'
                      ? 'warning'
                      : 'default';
              return (
                <Grid key={factor.label} size={{ xs: 12, md: 6 }}>
                  <SectionCard>
                    <Stack spacing={1.25}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                      >
                        <Typography variant="h4">{factor.label}</Typography>
                        <Chip
                          size="small"
                          color={color}
                          label={factor.status.replaceAll('_', ' ')}
                        />
                      </Stack>
                      <Typography color="text.secondary">{factor.fact}</Typography>
                    </Stack>
                  </SectionCard>
                </Grid>
              );
            })}
          </Grid>
          <SectionCard>
            <Typography variant="h3">Consultant findings</Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
              {review.findings.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  color={
                    f.severity === 'POSITIVE'
                      ? 'success'
                      : f.severity === 'CRITICAL'
                        ? 'error'
                        : f.severity === 'CAUTION'
                          ? 'warning'
                          : 'default'
                  }
                />
              ))}
            </Stack>
          </SectionCard>
          <SectionCard>
            <Typography variant="h3">Bureau scores and profile details</Typography>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {[
                ['Experian', snapshot.experianScore],
                ['Equifax', snapshot.equifaxScore],
                ['TransUnion', snapshot.transunionScore],
                [
                  'Average account age',
                  snapshot.averageAccountAgeMonths == null
                    ? null
                    : `${Math.floor(snapshot.averageAccountAgeMonths / 12)}y ${snapshot.averageAccountAgeMonths % 12}m`,
                ],
                ['Derogatory items', snapshot.derogatoryItems],
                ['Recent inquiries', snapshot.recentInquiries],
              ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 6, md: 4 }}>
                  <Typography variant="overline" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h4">{value ?? '—'}</Typography>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
          <SectionCard>
            <Typography variant="h3">Account snapshot</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Verified from {snapshot.source ?? 'the submitted credit report'} on{' '}
              {new Date(snapshot.capturedAt).toLocaleDateString()}.
            </Typography>
            {snapshot.accounts.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                No account-level details were recorded in this Review.
              </Typography>
            ) : (
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {snapshot.accounts.map((account) => {
                  const accountUtilization =
                    account.balance != null && account.creditLimit
                      ? Math.round((account.balance / account.creditLimit) * 100)
                      : null;
                  return (
                    <Stack
                      key={account.id}
                      spacing={1}
                      sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ justifyContent: 'space-between', gap: 1 }}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 850 }}>{account.creditorName}</Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={account.isOpen ? 'Open' : 'Closed'}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {account.accountType} · {account.paymentStatus ?? 'Status not reported'}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: { sm: 'right' } }}>
                          <Typography sx={{ fontWeight: 800 }}>
                            {formatMoney(account.balance)}{' '}
                            <Typography component="span" color="text.secondary">
                              / {formatMoney(account.creditLimit)}
                            </Typography>
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {accountUtilization == null
                              ? 'Utilization not reported'
                              : `${accountUtilization}% utilization`}
                          </Typography>
                        </Box>
                      </Stack>
                      {accountUtilization != null && (
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(accountUtilization, 100)}
                          color={
                            accountUtilization <= 30
                              ? 'success'
                              : accountUtilization <= 50
                                ? 'warning'
                                : 'error'
                          }
                        />
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </>
      )}
      {history.length > 1 && (
        <Box>
          <Typography variant="overline" color="primary">
            Point-in-time records
          </Typography>
          <Typography variant="h2">Review history</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Return to any previous Review and see the profile facts and source report recorded then.
          </Typography>
        </Box>
      )}
      {history.length > 1 && (
        <SectionCard>
          <Typography variant="h3">Previous Reviews</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Select a completed Review to load its historical scores, report facts, and source
            document above.
          </Typography>
          <Stack spacing={1.25}>
            {history.slice(1).map((item) => {
              const readinessLabel =
                item.generalReadiness === 'HIGH'
                  ? 'Ready for Application Round'
                  : item.generalReadiness === 'MEDIUM'
                    ? 'Action Needed First'
                    : item.generalReadiness === 'LOW'
                      ? 'Not Ready — Wait'
                      : item.generalReadiness.replaceAll('_', ' ');
              const selected = item.id === review.id;
              return (
                <Stack
                  key={item.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => setSelectedReviewId(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedReviewId(item.id);
                    }
                  }}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    justifyContent: 'space-between',
                    alignItems: { sm: 'center' },
                    gap: 1,
                    cursor: 'pointer',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    boxShadow: selected ? '0 0 24px rgba(69, 215, 240, .12)' : 'none',
                    transition: 'border-color 160ms ease, background-color 160ms ease',
                    '&:hover': { borderColor: 'primary.main' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 850 }}>
                      {item.completedAt
                        ? new Date(item.completedAt).toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Completed Review'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {v2 ? 'Historical credit report' : readinessLabel}
                    </Typography>
                  </Box>
                  <Typography color="primary" sx={{ fontWeight: 800 }}>
                    {selected ? 'Currently viewing' : 'View Review'}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

export function CreditProfilePage() {
  return <CreditProfilePageContent v2 />;
}

export function ClientReviewPage({
  embedded = false,
  onExit,
}: {
  embedded?: boolean;
  onExit?: () => void;
} = {}) {
  const collectStructuredDetails = false;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['review'],
    queryFn: () => apiRequest<{ review: Review | null }>('/api/v1/reviews/client'),
    retry: false,
  });
  const source = 'Experian 3-Bureau Credit Report';
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const eligibilityQuery = useQuery({
    queryKey: ['review-eligibility', reportDate],
    queryFn: () =>
      apiRequest<{ eligibility: ReviewEligibility }>(
        `/api/v1/reviews/client/eligibility?intendedReportDate=${encodeURIComponent(reportDate)}`,
      ),
    enabled: query.isSuccess && !query.data?.review && Boolean(reportDate),
    retry: false,
  });
  const [changes, setChanges] = useState<string[]>([]);
  const [changeDetails, setChangeDetails] = useState<Record<string, string>>({});
  const [applications, setApplications] = useState<RecentApplication[]>([]);
  const [applicationDraft, setApplicationDraft] = useState<RecentApplication>({
    issuer: '',
    date: new Date().toISOString().slice(0, 10),
    outcome: 'PENDING',
    scope: 'PERSONAL',
  });
  const [accountUpdates, setAccountUpdates] = useState<AccountUpdate[]>([]);
  const [creditAccountReviews, setCreditAccountReviews] = useState<CreditAccountReview[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardDraft, setNewCardDraft] = useState<CreditAccountReview>({
    status: 'NEW',
    cardName: '',
    issuer: '',
    scope: 'PERSONAL',
    accountStatus: 'OPEN',
  });
  const [accountDraft, setAccountDraft] = useState<AccountUpdate>({
    creditorName: '',
    changeType: 'BALANCE_CHANGED',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [reportInstructionsOpen, setReportInstructionsOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const cardsQuery = useQuery({
    queryKey: ['client-cards', 'review-intake'],
    queryFn: () =>
      apiRequest<{
        cards: Array<{
          id: string;
          cardName: string;
          issuer: string;
          scope: 'PERSONAL' | 'BUSINESS';
          accountStatus: string | null;
          balance: number | null;
          creditLimit: number | null;
        }>;
      }>('/api/v1/client/cards'),
    retry: false,
  });
  useEffect(() => {
    const intake = query.data?.review?.intake;
    if (!intake) return;
    if (intake.reportDate) setReportDate(intake.reportDate.slice(0, 10));
    if (intake.materialChanges) setChanges(intake.materialChanges);
    if (intake.materialChangeDetails)
      setChangeDetails(
        Object.fromEntries(intake.materialChangeDetails.map((item) => [item.type, item.details])),
      );
    if (intake.recentApplications) setApplications(intake.recentApplications);
    if (intake.accountUpdates) setAccountUpdates(intake.accountUpdates);
    if (intake.creditAccountReviews) setCreditAccountReviews(intake.creditAccountReviews);
    const resumeStep =
      intake.creditAccountsConfirmed != null
        ? 3
        : intake.materialChanges?.length
          ? 2
          : intake.reportDocument
            ? 1
            : 0;
    setWizardStep((step) => Math.max(step, resumeStep));
  }, [query.data?.review?.id]);
  const existingCards = cardsQuery.data?.cards ?? [];
  const allExistingCardsReviewed =
    cardsQuery.isSuccess &&
    existingCards.every((card) =>
      creditAccountReviews.some((reviewItem) => reviewItem.cardId === card.id),
    );
  const hasCreditAccountChanges = creditAccountReviews.some(
    (reviewItem) => reviewItem.status !== 'CONFIRMED',
  );
  const persistIntake = async () => {
    const review = query.data!.review!;
    await apiRequest(`/api/v1/reviews/client/${review.id}/intake`, {
      method: 'PATCH',
      body: JSON.stringify({
        reportSource: source,
        reportDate,
        materialChanges: changes,
        materialChangeDetails: changes
          .filter((type) => type !== 'No material changes')
          .map((type) => ({ type, details: changeDetails[type]?.trim() ?? '' })),
        recentApplications: applications,
        accountUpdates,
        creditAccountReviews,
        creditAccountsConfirmed: allExistingCardsReviewed ? !hasCreditAccountChanges : undefined,
      }),
    });
  };
  const upload = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Select a report file first.');
      return apiFileRequest(
        `/api/v1/reviews/client/${query.data!.review!.id}/report-document`,
        selectedFile,
      );
    },
    onSuccess: async () => {
      setSelectedFile(null);
      await persistIntake();
      await qc.invalidateQueries({ queryKey: ['review'] });
      setWizardStep(1);
    },
  });
  const continueIntake = useMutation({
    mutationFn: async (nextStep: number) => {
      await persistIntake();
      return nextStep;
    },
    onSuccess: async (nextStep) => {
      await qc.invalidateQueries({ queryKey: ['review'] });
      setWizardStep(nextStep);
    },
  });
  const saveCardReview = useMutation({
    mutationFn: (cardReview: CreditAccountReview) =>
      apiRequest<{ cardReview: CreditAccountReview }>(
        `/api/v1/reviews/client/${query.data!.review!.id}/card-review`,
        { method: 'POST', body: JSON.stringify(cardReview) },
      ),
    onSuccess: async ({ cardReview }) => {
      setCreditAccountReviews((items) => [
        ...items.filter((item) => item.cardId !== cardReview.cardId),
        cardReview,
      ]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['review'] }),
        qc.invalidateQueries({ queryKey: ['client-cards'] }),
      ]);
      setEditingCardId(null);
    },
  });
  const saveDraft = useMutation({
    mutationFn: persistIntake,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['review'] });
      onExit?.();
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      await persistIntake();
      const review = query.data!.review!;
      return apiRequest(`/api/v1/reviews/client/${review.id}/submit`, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review'] }),
  });
  const startReview = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/reviews/client', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ intendedReportDate: reportDate }),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['review'] }),
        qc.invalidateQueries({ queryKey: ['review-eligibility'] }),
      ]);
    },
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load Review.</Alert>;
  const review = query.data!.review;
  if (!review) {
    const eligibility = eligibilityQuery.data?.eligibility;
    return (
      <Stack spacing={3}>
        {!embedded && (
          <PageHeader
            eyebrow="Credit Profile"
            title="Start a Credit Profile Review"
            description="Confirm the report you intend to use, then reserve one Review Credit to begin."
          />
        )}
        <SectionCard variant="elevated">
          <Stack spacing={2}>
            <Typography variant="h3">Check Review eligibility</Typography>
            <Typography color="text.secondary">
              Enter the date printed on the credit report you plan to upload. The date must be newer
              than your latest accepted Review report; monthly timing is guidance, not a hard rule.
            </Typography>
            <TextField
              label="Intended report date"
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ maxWidth: 320 }}
            />
            {eligibilityQuery.isLoading && <LinearProgress aria-label="Checking eligibility" />}
            {eligibilityQuery.isError && (
              <Alert severity="error">Unable to check Review eligibility. Try again.</Alert>
            )}
            {eligibility && (
              <Alert severity={eligibility.eligible ? 'success' : 'info'}>
                {eligibility.reason} Available: {eligibility.credits.available}; reserved:{' '}
                {eligibility.credits.reserved}.
              </Alert>
            )}
            {startReview.isError && (
              <Alert severity="error">
                {startReview.error instanceof Error
                  ? startReview.error.message
                  : 'The Review could not be started.'}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {eligibility?.state === 'ELIGIBLE' && (
                <Button
                  variant="contained"
                  onClick={() => startReview.mutate()}
                  disabled={startReview.isPending}
                >
                  {startReview.isPending ? 'Reserving credit…' : 'Start Credit Review'}
                </Button>
              )}
              {eligibility?.state === 'PURCHASE_REQUIRED' && (
                <Button component={Link} to="/app/services" variant="contained">
                  Get a Review Credit
                </Button>
              )}
              {eligibility?.state === 'ACTIVE_REVIEW' && (
                <Button
                  onClick={() => qc.invalidateQueries({ queryKey: ['review'] })}
                  variant="contained"
                >
                  Resume Review
                </Button>
              )}
            </Stack>
          </Stack>
        </SectionCard>
      </Stack>
    );
  }
  if (!['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'].includes(review.status)) {
    const consultantWorking = review.status === 'CONSULTANT_REVIEW';
    const reviewComplete = review.status === 'COMPLETE';
    return (
      <Stack spacing={2}>
        {!embedded && (
          <PageHeader
            eyebrow="Credit Profile Review"
            title={reviewComplete ? 'Your Review is complete' : 'Your Review was submitted'}
            description={
              reviewComplete
                ? 'Your updated Credit Profile is ready.'
                : 'Your consultant has received your information.'
            }
          />
        )}
        <Box
          sx={{
            p: { xs: 1.75, sm: 2.25 },
            borderRadius: 1.75,
            border: 1,
            borderColor: reviewComplete ? 'rgba(66, 230, 164, .4)' : 'rgba(69, 215, 240, .34)',
            bgcolor: 'rgba(6, 18, 37, .52)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '0 0 auto',
              height: 3,
              background: reviewComplete
                ? 'linear-gradient(90deg, #42e6a4, #45d7f0)'
                : 'linear-gradient(90deg, #45d7f0, #8d7cff)',
            },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.4,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: '#061321',
                background: reviewComplete
                  ? 'linear-gradient(135deg, #42e6a4, #45d7f0)'
                  : 'linear-gradient(135deg, #45d7f0, #8d7cff)',
              }}
            >
              <CheckRounded />
            </Box>
            <Box>
              <Typography
                variant="overline"
                color={reviewComplete ? 'success.main' : 'primary.main'}
              >
                {reviewComplete ? 'Review complete' : 'Successfully submitted'}
              </Typography>
              <Typography variant="h3">
                {reviewComplete
                  ? 'Your Credit Profile is ready'
                  : 'Your information is with your consultant'}
              </Typography>
            </Box>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 1.25 }}>
            {reviewComplete
              ? 'Your consultant completed the Review and published your updated Credit Profile. The readiness decision is available in the next cycle stage.'
              : consultantWorking
                ? 'Your consultant is reviewing the report and information you provided.'
                : 'No further action is needed right now. Your consultant will begin the Review and contact you if anything else is required.'}
          </Typography>
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'rgba(5, 13, 29, .28)',
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Review progress
          </Typography>
          <Stack spacing={0} sx={{ mt: 1 }}>
            {[
              {
                label: 'Information submitted',
                detail: 'Your report and account details were received.',
                complete: true,
                active: false,
              },
              {
                label: 'Consultant Review started',
                detail:
                  consultantWorking || reviewComplete
                    ? 'Your consultant is verifying the uploaded report, confirmed credit accounts, and recent information you provided.'
                    : 'Your Review is queued for your consultant to begin reviewing the submitted information.',
                complete: consultantWorking || reviewComplete,
                active: !consultantWorking && !reviewComplete,
              },
              {
                label: 'Credit Profile updated',
                detail: reviewComplete
                  ? 'Your verified Credit Profile is available. Continue to the next cycle stage for the readiness decision.'
                  : consultantWorking
                    ? 'Your consultant is preparing the verified Credit Profile used for the next readiness stage.'
                    : 'Your Credit Profile will update after the consultant completes the Review.',
                complete: reviewComplete,
                active: consultantWorking,
              },
            ].map((stage, index) => (
              <Stack
                key={stage.label}
                direction="row"
                spacing={1.15}
                sx={{ minHeight: 58, position: 'relative' }}
              >
                <Box
                  sx={{
                    width: 28,
                    display: 'flex',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {index < 2 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 27,
                        bottom: -1,
                        width: 2,
                        bgcolor: stage.complete ? 'success.main' : 'divider',
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      zIndex: 1,
                      border: 1,
                      borderColor: stage.complete
                        ? 'success.main'
                        : stage.active
                          ? 'primary.main'
                          : 'divider',
                      bgcolor: stage.complete
                        ? 'success.main'
                        : stage.active
                          ? 'rgba(69, 215, 240, .12)'
                          : 'background.paper',
                      color: stage.complete
                        ? '#061321'
                        : stage.active
                          ? 'primary.main'
                          : 'text.disabled',
                    }}
                  >
                    {stage.complete ? (
                      <CheckRounded sx={{ fontSize: 17 }} />
                    ) : (
                      <Typography variant="caption" sx={{ fontWeight: 900 }}>
                        {index + 1}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ pb: 1.25 }}>
                  <Typography
                    sx={{ fontWeight: 850, color: stage.active ? 'primary.main' : 'text.primary' }}
                  >
                    {stage.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stage.detail}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
          {reviewComplete ? (
            <Button
              fullWidth
              component={Link}
              to="/app/credit-center"
              variant="contained"
              startIcon={<VisibilityRounded />}
              sx={{ mt: 0.5 }}
            >
              View Credit Profile
            </Button>
          ) : embedded && onExit ? (
            <Button fullWidth variant="outlined" onClick={onExit} sx={{ mt: 0.5 }}>
              Return to application cycle
            </Button>
          ) : null}
        </Box>

        {!reviewComplete && (
          <Box sx={{ px: 1.25, py: 1, borderRadius: 1.25, bgcolor: 'rgba(69, 215, 240, .055)' }}>
            <Typography variant="body2" color="text.secondary">
              You can leave this page safely. We’ll notify you when the Review moves forward.
            </Typography>
          </Box>
        )}
      </Stack>
    );
  }
  const toggle = (v: string) =>
    setChanges((current) => {
      if (v === 'No material changes') return current.includes(v) ? [] : ['No material changes'];
      const withoutNoChanges = current.filter((item) => item !== 'No material changes');
      return withoutNoChanges.includes(v)
        ? withoutNoChanges.filter((item) => item !== v)
        : [...withoutNoChanges, v];
    });
  return (
    <Stack spacing={3}>
      {!embedded && (
        <PageHeader
          eyebrow="Credit Profile Review"
          title="Update your credit information"
          description="A short guided intake gives your consultant the current facts needed for review."
        />
      )}
      {review.status === 'INFORMATION_REQUESTED' && review.intake?.informationRequest && (
        <Alert severity="warning">
          <Typography sx={{ fontWeight: 850 }}>Your consultant needs more information</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {review.intake.informationRequest.reasons
              .map((reason) => reason.replaceAll('_', ' ').toLowerCase())
              .join(' · ')}
            {review.intake.informationRequest.note
              ? ` — ${review.intake.informationRequest.note}`
              : ''}
          </Typography>
        </Alert>
      )}
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="overline" color="primary">
            Review intake
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Step {wizardStep + 1} of 4
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={((wizardStep + 1) / 4) * 100} />
      </Box>
      {wizardStep === 0 && (
        <SectionCard
          variant="elevated"
          sx={
            embedded
              ? {
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                }
              : {}
          }
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h3">1. Get your 3-bureau credit report</Typography>
              <Typography color="text.secondary">
                Obtain one combined report containing Experian, Equifax, and TransUnion information,
                then save and upload the complete report as a PDF.
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: 1,
                borderColor: 'rgba(69, 215, 240, .28)',
                bgcolor: 'rgba(69, 215, 240, .055)',
              }}
            >
              <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 1.25,
                    bgcolor: 'rgba(69, 215, 240, .13)',
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DescriptionRounded />
                </Box>
                <Box>
                  <Typography variant="overline" color="primary">
                    Recommended source
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.05 }}>
                    Experian 3-bureau report
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Experian provides a combined report covering all three national credit bureaus.
                Experian may charge for this product, so review its current terms before continuing.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  component="a"
                  href="https://www.experian.com/credit/experian-equifax-transunion-credit-report-and-score/"
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                >
                  Open Experian
                </Button>
                <Button
                  onClick={() => setReportInstructionsOpen((open) => !open)}
                  endIcon={
                    <ChevronRightRounded
                      sx={{
                        transform: reportInstructionsOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 180ms ease',
                      }}
                    />
                  }
                >
                  {reportInstructionsOpen ? 'Hide instructions' : 'How to get the report'}
                </Button>
              </Stack>
              <Collapse in={reportInstructionsOpen}>
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <Stack spacing={1.15}>
                    {[
                      [
                        '1',
                        'Open the Experian 3-bureau report page and choose the option to get the report.',
                      ],
                      [
                        '2',
                        'Sign in to Experian or create an account, then complete its identity-verification steps.',
                      ],
                      [
                        '3',
                        'Select the report that includes Experian, Equifax, and TransUnion, and review Experian’s current price and terms before purchasing.',
                      ],
                      [
                        '4',
                        'Open the complete 3-bureau report. Use its download option, or your browser’s Print command and choose “Save as PDF.”',
                      ],
                      [
                        '5',
                        'Save every page as one PDF. Make sure the report date and all three bureaus are visible, and remove password protection before uploading.',
                      ],
                    ].map(([number, instruction]) => (
                      <Stack
                        key={number}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'flex-start' }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'rgba(69, 215, 240, .14)',
                            color: 'primary.main',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          {number}
                        </Box>
                        <Typography variant="body2" sx={{ pt: 0.15 }}>
                          {instruction}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 1.75,
                border: '1px dashed rgba(130, 207, 232, .5)',
                bgcolor: 'rgba(5, 13, 29, .24)',
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  mx: 'auto',
                  borderRadius: '50%',
                  bgcolor: 'rgba(69, 215, 240, .12)',
                  color: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <UploadFileRounded />
              </Box>
              <Typography variant="h4" sx={{ mt: 1.1 }}>
                Upload the complete PDF
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                One PDF containing every page · Maximum 15 MB
              </Typography>
              <Button
                component="label"
                variant="contained"
                sx={{ mt: 1.5, minWidth: { xs: '100%', sm: 220 } }}
              >
                Choose PDF
                <input
                  hidden
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && file.type !== 'application/pdf') {
                      setSelectedFile(null);
                      setFileValidationError('Choose a PDF credit-report file.');
                      return;
                    }
                    setFileValidationError(null);
                    setSelectedFile(file);
                  }}
                />
              </Button>
            </Box>
            {fileValidationError && <Alert severity="error">{fileValidationError}</Alert>}
            {selectedFile && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' } }}
              >
                <Typography sx={{ flex: 1 }}>
                  {selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => upload.mutate()}
                  disabled={upload.isPending}
                >
                  {upload.isPending ? 'Uploading…' : 'Upload report'}
                </Button>
              </Stack>
            )}
            {review.intake?.reportDocument && (
              <Alert severity="success">
                Uploaded: {review.intake.reportDocument.originalFileName}
              </Alert>
            )}
            {upload.isError && <Alert severity="error">{upload.error.message}</Alert>}
            <TextField
              type="date"
              label="Report date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {review.intake?.reportDocument && (
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  disabled={!reportDate || continueIntake.isPending}
                  onClick={() => continueIntake.mutate(1)}
                >
                  {continueIntake.isPending ? 'Saving…' : 'Continue'}
                </Button>
              </Stack>
            )}
          </Stack>
        </SectionCard>
      )}
      {wizardStep === 1 && (
        <SectionCard
          sx={
            embedded
              ? {
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                }
              : {}
          }
        >
          <Typography variant="h3">2. Additional information</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Select anything that happened after the report date or may not appear on the report.
          </Typography>
          <Grid container spacing={1.5}>
            {(
              [
                ['New application', 'Tell us the lender or issuer, approximate date, and result.'],
                [
                  'New account',
                  'Tell us the creditor, account type, opening date, and current status.',
                ],
                [
                  'Balance changed',
                  'Tell us which account changed and its approximate current balance.',
                ],
                [
                  'Credit limit changed',
                  'Tell us which account changed and its approximate new limit.',
                ],
                [
                  'Late payment',
                  'Tell us the account, payment month, and whether it has been resolved.',
                ],
                ['No material changes', ''],
              ] as const
            ).map(([type, prompt]) => (
              <Grid key={type} size={{ xs: 12 }}>
                <Box
                  sx={{
                    height: '100%',
                    overflow: 'hidden',
                    borderRadius: 1.25,
                    border: '1px solid',
                    borderColor: changes.includes(type)
                      ? type === 'No material changes'
                        ? 'rgba(66, 230, 164, .42)'
                        : 'rgba(69, 215, 240, .42)'
                      : 'divider',
                    bgcolor: changes.includes(type)
                      ? type === 'No material changes'
                        ? 'rgba(66, 230, 164, .045)'
                        : 'rgba(69, 215, 240, .045)'
                      : 'rgba(5, 13, 29, .2)',
                    transition: 'border-color 180ms ease, background-color 180ms ease',
                  }}
                >
                  <ButtonBase
                    onClick={() => toggle(type)}
                    aria-pressed={changes.includes(type)}
                    sx={{
                      width: '100%',
                      px: 1.5,
                      py: 1.15,
                      gap: 1,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                    }}
                  >
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: 0.6,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        border: '1px solid',
                        borderColor: changes.includes(type)
                          ? type === 'No material changes'
                            ? 'success.main'
                            : 'primary.main'
                          : 'text.secondary',
                        bgcolor: changes.includes(type)
                          ? type === 'No material changes'
                            ? 'success.main'
                            : 'primary.main'
                          : 'transparent',
                        color: changes.includes(type) ? 'background.default' : 'transparent',
                      }}
                    >
                      <CheckRounded sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 850 }}>{type}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type === 'No material changes'
                          ? 'Nothing else needs to be reported'
                          : changes.includes(type)
                            ? 'Add any helpful context below'
                            : 'Select if this occurred after the report date'}
                      </Typography>
                    </Box>
                  </ButtonBase>
                  {type !== 'No material changes' && (
                    <Collapse in={changes.includes(type)}>
                      <Box
                        sx={{
                          px: 1.5,
                          pt: 1.1,
                          pb: 1.35,
                          borderTop: 1,
                          borderColor: 'rgba(130, 207, 232, .16)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 0.35 }}
                        >
                          Additional details{' '}
                          <Box component="span" sx={{ opacity: 0.7 }}>
                            (optional)
                          </Box>
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          variant="standard"
                          placeholder={prompt}
                          value={changeDetails[type] ?? ''}
                          onChange={(event) =>
                            setChangeDetails((current) => ({
                              ...current,
                              [type]: event.target.value,
                            }))
                          }
                          slotProps={{ htmlInput: { maxLength: 1000 } }}
                          sx={{
                            '& .MuiInputBase-root': { alignItems: 'flex-start', pt: 0.25 },
                            '& textarea::placeholder': { opacity: 0.72 },
                          }}
                        />
                      </Box>
                    </Collapse>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ mt: 2, justifyContent: 'flex-end' }}
          >
            <Button onClick={() => setWizardStep(0)}>Back</Button>
            <Button
              variant="contained"
              disabled={changes.length === 0 || continueIntake.isPending}
              onClick={() => continueIntake.mutate(2)}
            >
              {continueIntake.isPending ? 'Saving…' : 'Continue to credit accounts'}
            </Button>
          </Stack>
        </SectionCard>
      )}
      {collectStructuredDetails && (
        <SectionCard>
          <Typography variant="h3">3. Applications and accounts</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Add only activity that occurred after the report or is missing from it.
          </Typography>
          <Typography variant="h4">Recent applications</Typography>
          {applications.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              No recent applications added.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {applications.map((application, index) => (
                <Stack
                  key={`${application.issuer}-${application.date}-${index}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    alignItems: { sm: 'center' },
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{application.issuer}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {application.scope.toLowerCase()} · {application.outcome.toLowerCase()} ·{' '}
                      {new Date(`${application.date}T12:00:00`).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Button
                    color="warning"
                    onClick={() =>
                      setApplications((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
          <Grid container spacing={1.25} sx={{ mt: 2 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                fullWidth
                label="Issuer or lender"
                value={applicationDraft.issuer}
                onChange={(event) =>
                  setApplicationDraft({ ...applicationDraft, issuer: event.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                type="date"
                label="Application date"
                value={applicationDraft.date}
                onChange={(event) =>
                  setApplicationDraft({ ...applicationDraft, date: event.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            {(['APPROVED', 'PENDING', 'DECLINED', 'ABANDONED'] as const).map((outcome) => (
              <Grid key={outcome} size={{ xs: 6, md: 3 }}>
                <ChoiceCard
                  title={outcome.charAt(0) + outcome.slice(1).toLowerCase()}
                  selected={applicationDraft.outcome === outcome}
                  onClick={() => setApplicationDraft({ ...applicationDraft, outcome })}
                />
              </Grid>
            ))}
            <Grid size={{ xs: 12, sm: 6 }}>
              <ChoiceCard
                title="Personal"
                selected={applicationDraft.scope === 'PERSONAL'}
                onClick={() => setApplicationDraft({ ...applicationDraft, scope: 'PERSONAL' })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ChoiceCard
                title="Business"
                selected={applicationDraft.scope === 'BUSINESS'}
                onClick={() => setApplicationDraft({ ...applicationDraft, scope: 'BUSINESS' })}
              />
            </Grid>
            {applicationDraft.outcome === 'APPROVED' && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Approved amount or limit"
                  value={applicationDraft.approvedAmount ?? ''}
                  onChange={(event) =>
                    setApplicationDraft({
                      ...applicationDraft,
                      approvedAmount: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </Grid>
            )}
          </Grid>
          <Button
            variant="outlined"
            sx={{ mt: 1.5 }}
            disabled={!applicationDraft.issuer.trim() || !applicationDraft.date}
            onClick={() => {
              setApplications((current) => [
                ...current,
                { ...applicationDraft, issuer: applicationDraft.issuer.trim() },
              ]);
              setApplicationDraft({
                issuer: '',
                date: new Date().toISOString().slice(0, 10),
                outcome: 'PENDING',
                scope: 'PERSONAL',
              });
            }}
          >
            Add application
          </Button>
          <Box sx={{ my: 3, borderTop: 1, borderColor: 'divider' }} />
          <Typography variant="h4">Account changes</Typography>
          {accountUpdates.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              No account changes added.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {accountUpdates.map((update, index) => (
                <Stack
                  key={`${update.creditorName}-${update.changeType}-${index}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    alignItems: { sm: 'center' },
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{update.creditorName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {update.changeType.replaceAll('_', ' ').toLowerCase()}
                    </Typography>
                  </Box>
                  <Button
                    color="warning"
                    onClick={() =>
                      setAccountUpdates((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
          <TextField
            fullWidth
            label="Creditor or issuer"
            value={accountDraft.creditorName}
            onChange={(event) =>
              setAccountDraft({ ...accountDraft, creditorName: event.target.value })
            }
            sx={{ mt: 2 }}
          />
          <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
            {(
              [
                ['NEW_ACCOUNT', 'New account'],
                ['BALANCE_CHANGED', 'Balance changed'],
                ['LIMIT_CHANGED', 'Limit changed'],
                ['ACCOUNT_CLOSED', 'Account closed'],
                ['NOT_MINE', 'Not my account'],
                ['AUTHORIZED_USER_CHANGED', 'Authorized-user change'],
                ['PROMOTIONAL_OFFER_CHANGED', 'Promotional offer changed'],
              ] as const
            ).map(([id, label]) => (
              <Grid key={id} size={{ xs: 12, sm: 6, md: 4 }}>
                <ChoiceCard
                  title={label}
                  selected={accountDraft.changeType === id}
                  onClick={() =>
                    setAccountDraft({ creditorName: accountDraft.creditorName, changeType: id })
                  }
                />
              </Grid>
            ))}
            {['NEW_ACCOUNT', 'BALANCE_CHANGED'].includes(accountDraft.changeType) && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Current balance"
                  value={accountDraft.balance ?? ''}
                  onChange={(event) =>
                    setAccountDraft({
                      ...accountDraft,
                      balance: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </Grid>
            )}
            {['NEW_ACCOUNT', 'LIMIT_CHANGED'].includes(accountDraft.changeType) && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Current credit limit"
                  value={accountDraft.creditLimit ?? ''}
                  onChange={(event) =>
                    setAccountDraft({
                      ...accountDraft,
                      creditLimit: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </Grid>
            )}
          </Grid>
          <Button
            variant="outlined"
            sx={{ mt: 1.5 }}
            disabled={!accountDraft.creditorName.trim()}
            onClick={() => {
              setAccountUpdates((current) => [
                ...current,
                { ...accountDraft, creditorName: accountDraft.creditorName.trim() },
              ]);
              setAccountDraft({ creditorName: '', changeType: 'BALANCE_CHANGED' });
            }}
          >
            Add account change
          </Button>
        </SectionCard>
      )}
      {wizardStep === 2 && (
        <SectionCard
          variant="elevated"
          sx={
            embedded
              ? {
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                }
              : {}
          }
        >
          <Typography variant="h3">3. Verify credit-card accounts</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            Review the credit-card accounts recorded in your Credit Profile. Confirm the details or
            report an account that needs to be added or corrected. This is not payment-card
            information.
          </Typography>
          {!cardsQuery.isLoading && existingCards.length > 0 && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1.5,
                background:
                  'linear-gradient(110deg, rgba(69, 215, 240, .1), rgba(141, 124, 255, .07))',
                border: 1,
                borderColor: 'rgba(130, 207, 232, .24)',
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
              >
                <Box>
                  <Typography variant="overline" color="primary">
                    Account review
                  </Typography>
                  <Typography sx={{ fontWeight: 850 }}>
                    {creditAccountReviews.filter((item) => item.cardId).length} of{' '}
                    {existingCards.length} cards reviewed
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: 24,
                    fontWeight: 950,
                    color: allExistingCardsReviewed ? 'success.main' : 'primary.main',
                  }}
                >
                  {Math.round(
                    (creditAccountReviews.filter((item) => item.cardId).length /
                      existingCards.length) *
                      100,
                  )}
                  %
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={
                  (creditAccountReviews.filter((item) => item.cardId).length /
                    existingCards.length) *
                  100
                }
                color={allExistingCardsReviewed ? 'success' : 'primary'}
                sx={{ mt: 1 }}
              />
            </Box>
          )}
          {cardsQuery.isLoading ? (
            <LoadingSkeleton />
          ) : cardsQuery.data?.cards.length ? (
            <Stack spacing={1.25}>
              {cardsQuery.data.cards.map((card, cardIndex) => {
                const cardReview = creditAccountReviews.find((item) => item.cardId === card.id);
                const editing = editingCardId === card.id;
                const currentReview: CreditAccountReview = cardReview ?? {
                  cardId: card.id,
                  status: 'UPDATED',
                  cardName: card.cardName,
                  issuer: card.issuer,
                  scope: card.scope,
                  accountStatus: card.accountStatus === 'CLOSED' ? 'CLOSED' : 'OPEN',
                  ...(card.balance != null ? { balance: card.balance } : {}),
                  ...(card.creditLimit != null ? { creditLimit: card.creditLimit } : {}),
                };
                const saveExistingReview = (next: CreditAccountReview) =>
                  setCreditAccountReviews((items) => [
                    ...items.filter((item) => item.cardId !== card.id),
                    next,
                  ]);
                return (
                  <Box
                    key={card.id}
                    sx={{
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid',
                      borderColor: cardReview
                        ? editing
                          ? 'rgba(255, 183, 77, .42)'
                          : 'rgba(66, 230, 164, .38)'
                        : 'divider',
                      borderRadius: 1.5,
                      bgcolor: cardReview
                        ? editing
                          ? 'rgba(255, 183, 77, .035)'
                          : 'rgba(66, 230, 164, .035)'
                        : 'rgba(5, 13, 29, .22)',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: '0 0 auto',
                        height: 3,
                        background: cardReview
                          ? editing
                            ? 'linear-gradient(90deg, #ffb74d, #8d7cff)'
                            : 'linear-gradient(90deg, #42e6a4, #45d7f0)'
                          : cardIndex % 2
                            ? 'linear-gradient(90deg, #8d7cff, #45d7f0)'
                            : 'linear-gradient(90deg, #45d7f0, #38dfa7)',
                      },
                    }}
                  >
                    <Box sx={{ p: 1.5, pt: 1.75 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.1,
                            bgcolor: 'rgba(69, 215, 240, .1)',
                            color: 'primary.main',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CreditCardRounded sx={{ fontSize: 20 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900 }}>{card.cardName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {card.issuer} · {card.scope.toLowerCase()}
                          </Typography>
                        </Box>
                        {cardReview && (
                          <Chip
                            size="small"
                            color={cardReview.status === 'CONFIRMED' ? 'success' : 'warning'}
                            label={
                              cardReview.status === 'CONFIRMED'
                                ? 'Confirmed'
                                : cardReview.status === 'NEW'
                                  ? 'Added'
                                  : 'Updated'
                            }
                          />
                        )}
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: 1,
                          mt: 1.25,
                        }}
                      >
                        {[
                          ['Status', (card.accountStatus ?? 'Not recorded').toLowerCase()],
                          [
                            'Limit',
                            card.creditLimit == null
                              ? '—'
                              : `$${card.creditLimit.toLocaleString()}`,
                          ],
                          [
                            'Balance',
                            card.balance == null ? '—' : `$${card.balance.toLocaleString()}`,
                          ],
                        ].map(([label, value]) => (
                          <Box key={label}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                textTransform: 'uppercase',
                                fontSize: 9,
                                letterSpacing: '.08em',
                              }}
                            >
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.15, fontWeight: 800 }}>
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        borderTop: 1,
                        borderColor: 'divider',
                        bgcolor: 'rgba(5, 13, 29, .16)',
                      }}
                    >
                      <ButtonBase
                        disabled={saveCardReview.isPending}
                        onClick={() =>
                          saveCardReview.mutate({
                            ...currentReview,
                            status: 'CONFIRMED',
                            cardName: card.cardName,
                            issuer: card.issuer,
                            scope: card.scope,
                            accountStatus: card.accountStatus === 'CLOSED' ? 'CLOSED' : 'OPEN',
                          })
                        }
                        sx={{
                          minHeight: 44,
                          px: 1,
                          gap: 0.6,
                          color:
                            cardReview?.status === 'CONFIRMED' ? 'success.main' : 'primary.main',
                          fontSize: 13,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <CheckRounded sx={{ fontSize: 17 }} /> Looks correct
                      </ButtonBase>
                      <ButtonBase
                        onClick={() => {
                          saveExistingReview({ ...currentReview, status: 'UPDATED' });
                          setEditingCardId(card.id);
                        }}
                        sx={{
                          minHeight: 44,
                          px: 1,
                          borderLeft: 1,
                          borderColor: 'divider',
                          color: editing ? 'warning.main' : 'primary.main',
                          fontSize: 13,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Update details
                      </ButtonBase>
                    </Box>
                    <Collapse in={editing}>
                      <Box sx={{ px: 1.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
                        <Grid container spacing={1.25}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                              fullWidth
                              label="Card name"
                              value={currentReview.cardName}
                              onChange={(event) =>
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  cardName: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                              fullWidth
                              label="Issuer"
                              value={currentReview.issuer}
                              onChange={(event) =>
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  issuer: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Current limit"
                              value={currentReview.creditLimit ?? ''}
                              onChange={(event) =>
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  creditLimit: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Current balance"
                              value={currentReview.balance ?? ''}
                              onChange={(event) =>
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  balance: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <ToggleButtonGroup
                              exclusive
                              fullWidth
                              value={currentReview.scope}
                              onChange={(_, value: 'PERSONAL' | 'BUSINESS' | null) =>
                                value &&
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  scope: value,
                                })
                              }
                            >
                              <ToggleButton value="PERSONAL">Personal</ToggleButton>
                              <ToggleButton value="BUSINESS">Business</ToggleButton>
                            </ToggleButtonGroup>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <ToggleButtonGroup
                              exclusive
                              fullWidth
                              value={currentReview.accountStatus}
                              onChange={(_, value: 'OPEN' | 'CLOSED' | null) =>
                                value &&
                                saveExistingReview({
                                  ...currentReview,
                                  status: 'UPDATED',
                                  accountStatus: value,
                                })
                              }
                            >
                              <ToggleButton value="OPEN">Open</ToggleButton>
                              <ToggleButton value="CLOSED">Closed</ToggleButton>
                            </ToggleButtonGroup>
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <Button
                              fullWidth
                              variant="contained"
                              startIcon={<CheckRounded />}
                              disabled={
                                saveCardReview.isPending ||
                                !currentReview.cardName.trim() ||
                                !currentReview.issuer.trim()
                              }
                              onClick={() => saveCardReview.mutate(currentReview)}
                            >
                              {saveCardReview.isPending ? 'Saving…' : 'Save card updates'}
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Alert severity="info">
              No credit cards are currently recorded. Add any cards that should be included in this
              Review.
            </Alert>
          )}
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h4">Missing a card?</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Add an account that is not listed above.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={newCardOpen ? <CloseRounded /> : <AddRounded />}
                onClick={() => setNewCardOpen((open) => !open)}
              >
                {newCardOpen ? 'Cancel' : 'Add card'}
              </Button>
            </Stack>
            <Collapse in={newCardOpen}>
              <Grid container spacing={1.25} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Card name"
                    value={newCardDraft.cardName}
                    onChange={(event) =>
                      setNewCardDraft({ ...newCardDraft, cardName: event.target.value })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Issuer"
                    value={newCardDraft.issuer}
                    onChange={(event) =>
                      setNewCardDraft({ ...newCardDraft, issuer: event.target.value })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Current limit"
                    value={newCardDraft.creditLimit ?? ''}
                    onChange={(event) =>
                      setNewCardDraft({
                        ...newCardDraft,
                        creditLimit: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Current balance"
                    value={newCardDraft.balance ?? ''}
                    onChange={(event) =>
                      setNewCardDraft({
                        ...newCardDraft,
                        balance: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={newCardDraft.scope}
                    onChange={(_, value: 'PERSONAL' | 'BUSINESS' | null) =>
                      value && setNewCardDraft({ ...newCardDraft, scope: value })
                    }
                  >
                    <ToggleButton value="PERSONAL">Personal</ToggleButton>
                    <ToggleButton value="BUSINESS">Business</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={newCardDraft.accountStatus}
                    onChange={(_, value: 'OPEN' | 'CLOSED' | null) =>
                      value && setNewCardDraft({ ...newCardDraft, accountStatus: value })
                    }
                  >
                    <ToggleButton value="OPEN">Open</ToggleButton>
                    <ToggleButton value="CLOSED">Closed</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    variant="contained"
                    disabled={
                      saveCardReview.isPending ||
                      !newCardDraft.cardName.trim() ||
                      !newCardDraft.issuer.trim()
                    }
                    onClick={() =>
                      saveCardReview.mutate(
                        {
                          ...newCardDraft,
                          cardName: newCardDraft.cardName.trim(),
                          issuer: newCardDraft.issuer.trim(),
                        },
                        {
                          onSuccess: () => {
                            setNewCardDraft({
                              status: 'NEW',
                              cardName: '',
                              issuer: '',
                              scope: 'PERSONAL',
                              accountStatus: 'OPEN',
                            });
                            setNewCardOpen(false);
                          },
                        },
                      )
                    }
                  >
                    {saveCardReview.isPending ? 'Adding…' : 'Add card'}
                  </Button>
                </Grid>
              </Grid>
            </Collapse>
            {creditAccountReviews
              .filter((item) => item.status === 'NEW')
              .map((item, index) => (
                <Stack
                  key={`${item.issuer}-${item.cardName}-${index}`}
                  direction="row"
                  spacing={1}
                  sx={{
                    mt: 1.25,
                    p: 1.25,
                    alignItems: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.25,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 850 }}>{item.cardName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.issuer} · new card
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    color="warning"
                    onClick={() =>
                      setCreditAccountReviews((items) =>
                        items.filter((candidate) => candidate !== item),
                      )
                    }
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
          </Box>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ mt: 2, justifyContent: 'flex-end' }}
          >
            <Button onClick={() => setWizardStep(1)}>Back</Button>
            <Button
              variant="contained"
              disabled={continueIntake.isPending || !allExistingCardsReviewed}
              onClick={() => continueIntake.mutate(3)}
            >
              {continueIntake.isPending ? 'Saving…' : 'Confirm and continue'}
            </Button>
          </Stack>
        </SectionCard>
      )}
      {wizardStep === 3 && (
        <SectionCard
          variant="elevated"
          sx={
            embedded
              ? {
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                }
              : {}
          }
        >
          <Box sx={{ pb: 1.5, borderBottom: 1, borderColor: 'rgba(130, 207, 232, .16)' }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.25,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#061321',
                  background: 'linear-gradient(135deg, #45d7f0, #42e6a4)',
                  boxShadow: '0 8px 22px rgba(69, 215, 240, .14)',
                  flexShrink: 0,
                }}
              >
                <CheckRounded sx={{ fontSize: 21 }} />
              </Box>
              <Box>
                <Typography variant="overline" color="primary">
                  Final check
                </Typography>
                <Typography variant="h3">Review your information</Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.85, maxWidth: 520 }}>
              Make sure each section is accurate before sending it to your consultant.
            </Typography>
          </Box>

          <Stack spacing={1.1} sx={{ mt: 1.5 }}>
            <Box
              sx={{
                p: 1.4,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1.35,
                border: 1,
                borderColor: 'rgba(69, 215, 240, .28)',
                bgcolor: 'rgba(6, 18, 37, .42)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  bgcolor: 'primary.main',
                },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.1,
                    bgcolor: 'rgba(69, 215, 240, .12)',
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DescriptionRounded sx={{ fontSize: 19 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>Credit report</Typography>
                      <Stack
                        direction="row"
                        spacing={0.35}
                        sx={{ alignItems: 'center', color: 'success.main' }}
                      >
                        <CheckRounded sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontWeight: 850 }}>
                          Ready
                        </Typography>
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setWizardStep(0)}
                      sx={{ minWidth: 56, minHeight: 30, px: 1 }}
                    >
                      Edit
                    </Button>
                  </Stack>
                  <Typography sx={{ mt: 1, fontWeight: 800, overflowWrap: 'anywhere' }}>
                    {review.intake?.reportDocument?.originalFileName ?? 'Not uploaded'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {source} · Report dated{' '}
                    {new Date(`${reportDate}T12:00:00`).toLocaleDateString()}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 1.4,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1.35,
                border: 1,
                borderColor: 'rgba(66, 230, 164, .28)',
                bgcolor: 'rgba(6, 18, 37, .42)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  bgcolor: 'success.main',
                },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.1,
                    bgcolor: 'rgba(66, 230, 164, .12)',
                    color: 'success.main',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CreditCardRounded sx={{ fontSize: 19 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>Credit accounts</Typography>
                      <Stack
                        direction="row"
                        spacing={0.35}
                        sx={{ alignItems: 'center', color: 'success.main' }}
                      >
                        <CheckRounded sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontWeight: 850 }}>
                          All accounts reviewed
                        </Typography>
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setWizardStep(2)}
                      sx={{ minWidth: 56, minHeight: 30, px: 1 }}
                    >
                      Edit
                    </Button>
                  </Stack>
                  <Stack direction="row" useFlexGap spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      color="success"
                      label={`${creditAccountReviews.filter((item) => item.status === 'CONFIRMED').length} confirmed`}
                    />
                    {creditAccountReviews.filter((item) => item.status === 'UPDATED').length >
                      0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label={`${creditAccountReviews.filter((item) => item.status === 'UPDATED').length} updated`}
                      />
                    )}
                    {creditAccountReviews.filter((item) => item.status === 'NEW').length > 0 && (
                      <Chip
                        size="small"
                        color="primary"
                        label={`${creditAccountReviews.filter((item) => item.status === 'NEW').length} added`}
                      />
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 1.4,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1.35,
                border: 1,
                borderColor: 'rgba(141, 124, 255, .28)',
                bgcolor: 'rgba(6, 18, 37, .42)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  bgcolor: 'secondary.main',
                },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.1,
                    bgcolor: 'rgba(141, 124, 255, .12)',
                    color: 'secondary.main',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <HistoryRounded sx={{ fontSize: 19 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>Recent information</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
                        {changes.length
                          ? `${changes.length} change${changes.length === 1 ? '' : 's'} reported`
                          : 'No recent changes reported'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setWizardStep(1)}
                      sx={{ minWidth: 56, minHeight: 30, px: 1 }}
                    >
                      Edit
                    </Button>
                  </Stack>
                  {changes.length > 0 && (
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                      {changes.map((change) => (
                        <Box
                          key={change}
                          sx={{ py: 0.7, borderTop: 1, borderColor: 'rgba(141, 124, 255, .16)' }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 850 }}>
                            {change}
                          </Typography>
                          {changeDetails[change]?.trim() && (
                            <Typography variant="caption" color="text.secondary">
                              {changeDetails[change]}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </Box>
          </Stack>

          <Box
            sx={{
              mt: 1.75,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(5, 13, 29, .48)',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <CheckCircleRounded color="primary" sx={{ mt: 0.1 }} />
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Ready to send</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Your consultant will review these facts and provide the readiness decision. No
                  decision is generated automatically.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </SectionCard>
      )}
      {wizardStep === 3 && (
        <Stack spacing={1}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || saveDraft.isPending || !review.intake?.reportDocument}
            startIcon={<CheckRounded />}
          >
            {submit.isPending ? 'Sending…' : 'Send to consultant'}
          </Button>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Button onClick={() => setWizardStep(2)}>Back</Button>
            <Button
              onClick={() => saveDraft.mutate()}
              disabled={saveDraft.isPending || submit.isPending}
            >
              {saveDraft.isPending ? 'Saving…' : 'Save and finish later'}
            </Button>
          </Stack>
        </Stack>
      )}
      {saveDraft.isSuccess && <Alert severity="success">Your Review intake was saved.</Alert>}
      {(saveDraft.isError ||
        saveCardReview.isError ||
        continueIntake.isError ||
        submit.isError) && (
        <Alert severity="error">
          {saveDraft.error?.message ??
            saveCardReview.error?.message ??
            continueIntake.error?.message ??
            submit.error?.message}
        </Alert>
      )}
    </Stack>
  );
}

export function ConsultantReviewsPage() {
  const query = useQuery({
    queryKey: ['consultant-reviews'],
    queryFn: () =>
      apiRequest<{
        reviews: Array<{
          id: string;
          clientId: string;
          status: string;
          submittedAt: string | null;
          client: { firstName: string; lastName: string };
        }>;
      }>('/api/v1/reviews/consultant'),
    retry: false,
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Consultant operations"
        title="Credit Profile Reviews"
        description="Submitted Reviews ordered by age, with the next action prepared."
      />
      {query.isLoading ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <Alert severity="error">Unable to load the Review queue.</Alert>
      ) : query.data!.reviews.length === 0 ? (
        <SectionCard>
          <Typography variant="h3">Queue clear</Typography>
          <Typography color="text.secondary">No submitted Reviews need attention.</Typography>
        </SectionCard>
      ) : (
        query.data!.reviews.map((r) => (
          <SectionCard key={r.id} variant="operational">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4">
                  {r.client.firstName} {r.client.lastName}
                </Typography>
                <Typography color="text.secondary">
                  {r.status.replaceAll('_', ' ')} ·{' '}
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'Not submitted'}
                </Typography>
              </Box>
              <Button
                component={Link}
                to={`/crm/reviews/${r.clientId}/${r.id}`}
                endIcon={<ArrowForwardRounded />}
              >
                Open guided Review
              </Button>
            </Stack>
          </SectionCard>
        ))
      )}
    </Stack>
  );
}

export function ConsultantReviewWorkspacePage() {
  const { clientId, reviewId } = useParams();
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState('MEDIUM');
  const [selected, setSelected] = useState<string[]>(['UTILIZATION']);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [informationReasons, setInformationReasons] = useState<string[]>([]);
  const [facts] = useState({
    experian: '',
    equifax: '',
    transunion: '',
    utilization: '',
    limit: '',
    balance: '',
    accounts: '',
    inquiries: '',
    derogatories: '',
    averageAge: '',
  });
  const query = useQuery({
    queryKey: ['review-workspace', reviewId],
    queryFn: () =>
      apiRequest<{ review: Review }>(`/api/v1/reviews/consultant/${clientId}/${reviewId}`),
    enabled: !!clientId && !!reviewId,
    retry: false,
  });
  const options = useQuery({
    queryKey: ['consultant-options'],
    queryFn: () =>
      apiRequest<{
        options: Array<{
          id: string;
          kind: string;
          code: string;
          label: string;
          description: string | null;
        }>;
      }>('/api/v1/major-readiness/options'),
    retry: false,
  });
  const availableActionOptions = (options.data?.options ?? []).filter(
    (option) => option.kind === 'ACTION_BUNDLE',
  );
  useEffect(() => {
    if (readiness === 'HIGH' || selectedActions.length > 0) return;
    const suggestedAction = availableActionOptions[0];
    if (suggestedAction) setSelectedActions([suggestedAction.id]);
  }, [availableActionOptions, readiness, selectedActions.length]);
  const findings = [
    ['UTILIZATION', 'Utilization needs preparation', 'CAUTION'],
    ['PAYMENT_HISTORY', 'Payment history is strong', 'POSITIVE'],
    ['RECENT_INQUIRIES', 'Recent inquiry activity', 'CAUTION'],
    ['DEROGATORY', 'Derogatory item requires attention', 'CRITICAL'],
  ] as const;
  const summary = useMemo(
    () =>
      `${readiness === 'HIGH' ? 'Your current profile appears favorable for considering carefully planned credit activity.' : readiness === 'MEDIUM' ? 'Your current profile presents opportunities with meaningful constraints that should shape timing and selection.' : 'Waiting and nurturing the profile is currently preferred before new credit activity.'} This assessment is consultant guidance and not a prediction of lender approval.`,
    [readiness],
  );
  const startReview = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/reviews/consultant/${clientId}/${reviewId}/start`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await Promise.all([query.refetch(), options.refetch()]);
    },
  });
  const complete = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/reviews/consultant/${clientId}/${reviewId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          snapshot: {
            capturedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
            source: query.data?.review.intake?.reportSource ?? 'Client report',
            experianScore: facts.experian ? Number(facts.experian) : undefined,
            equifaxScore: facts.equifax ? Number(facts.equifax) : undefined,
            transunionScore: facts.transunion ? Number(facts.transunion) : undefined,
            aggregateUtilization: facts.utilization ? Number(facts.utilization) : undefined,
            revolvingLimit: facts.limit ? Number(facts.limit) : undefined,
            revolvingBalance: facts.balance ? Number(facts.balance) : undefined,
            openAccounts: facts.accounts ? Number(facts.accounts) : undefined,
            recentInquiries: facts.inquiries ? Number(facts.inquiries) : undefined,
            derogatoryItems: facts.derogatories ? Number(facts.derogatories) : undefined,
            averageAccountAgeMonths: facts.averageAge ? Number(facts.averageAge) : undefined,
            accounts: [],
          },
          generalReadiness: readiness,
          recommendation:
            readiness === 'HIGH'
              ? 'PROCEED'
              : readiness === 'MEDIUM'
                ? 'PREPARE_FIRST'
                : 'WAIT_NURTURE',
          readinessExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
          clientSummary: summary,
          findings: findings
            .filter((f) => selected.includes(f[0]))
            .map((f) => ({ code: f[0], label: f[1], severity: f[2] })),
          actionOptionIds: (options.data?.options ?? [])
            .filter((o) => o.kind === 'ACTION_BUNDLE' && selectedActions.includes(o.id))
            .map((o) => o.id),
        }),
      }),
    onSuccess: () => navigate('/consultant/reviews'),
  });
  const requestInformation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/reviews/consultant/${clientId}/${reviewId}/request-information`, {
        method: 'POST',
        body: JSON.stringify({ reasons: informationReasons }),
      }),
    onSuccess: () => navigate('/consultant/reviews'),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load Review workspace.</Alert>;
  const previousSnapshot = query.data?.review.client?.creditSnapshots?.[0];
  const actionRequired = readiness !== 'HIGH' && selectedActions.length === 0;
  const toggle = (v: string) =>
    setSelected((o) => (o.includes(v) ? o.filter((x) => x !== v) : [...o, v]));
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Selection-first Review workspace"
        title="Complete Credit Profile Review"
        description="Enter verified facts, select conclusions, preview the client result, then confirm."
        actions={
          query.data?.review.status === 'INFORMATION_RECEIVED' ? (
            <Button
              variant="contained"
              onClick={() => startReview.mutate()}
              disabled={startReview.isPending}
              startIcon={<PlayArrowRounded />}
            >
              {startReview.isPending ? 'Starting…' : 'Start Review'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => complete.mutate()}
              disabled={
                complete.isPending ||
                selected.length === 0 ||
                actionRequired ||
                query.data?.review.status !== 'CONSULTANT_REVIEW'
              }
            >
              {complete.isPending ? 'Completing…' : 'Confirm decision and complete'}
            </Button>
          )
        }
      />
      {query.data?.review.status === 'INFORMATION_RECEIVED' ? (
        <Alert severity="info">
          Start the Review when you begin consultant work. The client’s application cycle will
          update to show that the Review is in progress.
        </Alert>
      ) : query.data?.review.status === 'CONSULTANT_REVIEW' ? (
        <Alert severity="success">
          Review started. Verify the report, select the readiness decision, and confirm the
          completed Review when ready.
        </Alert>
      ) : null}
      {startReview.isError && <Alert severity="error">{startReview.error.message}</Alert>}
      {complete.isError && (
        <Alert severity="error">Review could not be completed: {complete.error.message}</Alert>
      )}
      {actionRequired && query.data?.review.status === 'CONSULTANT_REVIEW' && (
        <Alert severity="warning">
          Select at least one recommended plan action before completing an Action Needed or Not
          Ready decision.
        </Alert>
      )}
      <SectionCard variant="elevated">
        <Typography variant="h3">Client intake and previous profile</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Submitted report
            </Typography>
            <Typography variant="h4">
              {query.data?.review.intake?.reportSource ?? 'Source not recorded'}
            </Typography>
            <Typography color="text.secondary">
              {query.data?.review.intake?.reportDate
                ? new Date(query.data.review.intake.reportDate).toLocaleDateString()
                : 'Date not recorded'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Previous verified snapshot
            </Typography>
            {previousSnapshot ? (
              <Typography variant="h4">
                {previousSnapshot.experianScore ??
                  previousSnapshot.equifaxScore ??
                  previousSnapshot.transunionScore ??
                  'No score'}{' '}
                · {previousSnapshot.aggregateUtilization ?? '—'}% utilization
              </Typography>
            ) : (
              <Typography variant="h4">First Review</Typography>
            )}
            <Typography color="text.secondary">
              {previousSnapshot
                ? `Captured ${new Date(previousSnapshot.capturedAt).toLocaleDateString()}`
                : 'No previous snapshot to compare.'}
            </Typography>
          </Grid>
        </Grid>
      </SectionCard>
      <SectionCard variant="operational">
        <Typography variant="h3">Intake decision</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Continue when the submitted information is sufficient, or select exactly what the client
          must provide.
        </Typography>
        <Grid container spacing={1.25}>
          {(
            [
              ['UPDATED_REPORT', 'Updated credit report'],
              ['MISSING_ACCOUNT', 'Missing account'],
              ['ACCOUNT_DETAILS', 'Account details'],
              ['RECENT_APPLICATION', 'Recent application details'],
              ['IDENTITY_MISMATCH', 'Identity mismatch'],
              ['OTHER', 'Other clarification'],
            ] as const
          ).map(([id, label]) => (
            <Grid key={id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ChoiceCard
                title={label}
                selected={informationReasons.includes(id)}
                onClick={() =>
                  setInformationReasons((current) =>
                    current.includes(id)
                      ? current.filter((reason) => reason !== id)
                      : [...current, id],
                  )
                }
              />
            </Grid>
          ))}
        </Grid>
        <Button
          color="warning"
          variant="outlined"
          sx={{ mt: 2 }}
          disabled={informationReasons.length === 0 || requestInformation.isPending}
          onClick={() => requestInformation.mutate()}
        >
          {requestInformation.isPending ? 'Sending request…' : 'Request information from client'}
        </Button>
        {requestInformation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {requestInformation.error.message}
          </Alert>
        )}
      </SectionCard>
      {query.data?.review.intake?.reportDocument ? (
        <SectionCard>
          <Typography variant="h3">Uploaded credit report</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {query.data.review.intake.reportDocument.originalFileName}
          </Typography>
          <SecureReportViewer documentId={query.data.review.intake.reportDocument.id} />
        </SectionCard>
      ) : (
        <Alert severity="warning">
          This legacy Review has a report reference but no viewable stored document. Request a new
          upload before completing it.
        </Alert>
      )}
      <SectionCard variant="operational">
        <Typography variant="h3">Consultant decision</Typography>
        <Grid container spacing={1.5} sx={{ mt: 1 }}>
          {(
            [
              ['HIGH', 'Ready for Application Round'],
              ['MEDIUM', 'Action Needed First'],
              ['LOW', 'Not Ready — Wait'],
            ] as const
          ).map(([id, label]) => (
            <Grid key={id} size={{ xs: 12, md: 4 }}>
              <ChoiceCard
                title={label}
                description={
                  id === 'HIGH'
                    ? 'Profile appears favorable for considering a carefully planned Round.'
                    : id === 'MEDIUM'
                      ? 'Opportunities and meaningful constraints both exist.'
                      : 'Waiting and profile nurture are generally preferred.'
                }
                selected={readiness === id}
                onClick={() => setReadiness(id)}
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>
      <SectionCard>
        <Typography variant="h3">Prepared findings</Typography>
        <Grid container spacing={1.5} sx={{ mt: 1 }}>
          {findings.map((f) => (
            <Grid key={f[0]} size={{ xs: 12, md: 6 }}>
              <ChoiceCard
                title={f[1]}
                selected={selected.includes(f[0])}
                onClick={() => toggle(f[0])}
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>
      <SectionCard variant="operational">
        <Typography variant="h3">Recommended plan actions</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Select the actions that will appear in the client’s Credit Profile when this Review is
          confirmed.
        </Typography>
        <Grid container spacing={1.5}>
          {availableActionOptions.map((option) => (
            <Grid key={option.id} size={{ xs: 12, md: 6 }}>
              <ChoiceCard
                title={option.label}
                {...(option.description ? { description: option.description } : {})}
                selected={selectedActions.includes(option.id)}
                onClick={() =>
                  setSelectedActions((current) =>
                    current.includes(option.id)
                      ? current.filter((id) => id !== option.id)
                      : [...current, option.id],
                  )
                }
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>
      <SectionCard variant="elevated">
        <Stack spacing={1.5}>
          <Chip
            icon={<CheckCircleRounded />}
            label="Client-visible preview"
            color="primary"
            sx={{ alignSelf: 'flex-start' }}
          />
          <Typography variant="h3">
            {readiness === 'HIGH'
              ? 'Ready for Application Round'
              : readiness === 'MEDIUM'
                ? 'Action Needed First'
                : 'Not Ready — Wait'}
          </Typography>
          <Typography>{summary}</Typography>
        </Stack>
      </SectionCard>
      {query.data?.review.status === 'CONSULTANT_REVIEW' && (
        <Button
          fullWidth
          size="large"
          variant="contained"
          startIcon={<CheckRounded />}
          onClick={() => complete.mutate()}
          disabled={complete.isPending || selected.length === 0 || actionRequired}
        >
          {complete.isPending ? 'Completing Review…' : 'Complete Review and update Credit Profile'}
        </Button>
      )}
    </Stack>
  );
}
