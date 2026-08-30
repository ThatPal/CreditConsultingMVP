import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { designTokens } from '../theme';
type ServiceType = 'CREDIT_PROFILE_REVIEW' | 'CREDIT_CARD_ROUND' | 'MAJOR_APPLICATION_READINESS';
type Data = {
  catalog: Array<{
    serviceType: ServiceType;
    name: string;
    description: string;
    availability: 'PRICING_REQUIRED' | 'PROFILE_REQUIRED' | 'COMING_LATER';
  }>;
  purchases: Array<{
    id: string;
    serviceType: ServiceType;
    amount: number;
    currency: string;
    status: string;
    purchasedAt: string | null;
    createdAt: string;
  }>;
  reviewPlans: unknown[];
};
const icons = {
  CREDIT_PROFILE_REVIEW: AssessmentRounded,
  CREDIT_CARD_ROUND: CreditCardRounded,
  MAJOR_APPLICATION_READINESS: HomeWorkRounded,
};
const serviceNames: Record<ServiceType, string> = {
  CREDIT_PROFILE_REVIEW: 'Credit Profile Review',
  CREDIT_CARD_ROUND: 'Optimized Credit Applications',
  MAJOR_APPLICATION_READINESS: 'Credit Readiness',
};
const servicePresentation: Record<
  ServiceType,
  {
    number: string;
    category: string;
    outcome: string;
    includes: string[];
    accent: string;
    glow: string;
  }
> = {
  CREDIT_PROFILE_REVIEW: {
    number: '01',
    category: 'Foundation',
    outcome: 'Understand where your credit stands and what should happen next.',
    includes: [
      'Consultant report review',
      'Application readiness decision',
      'Prepared next actions',
    ],
    accent: '#42D3F2',
    glow: 'rgba(66, 211, 242, 0.18)',
  },
  CREDIT_CARD_ROUND: {
    number: '02',
    category: 'Application strategy',
    outcome: 'Apply in a coordinated sequence designed around your current profile and goals.',
    includes: [
      'Personalized card strategy',
      'Guided application session',
      'Results and follow-up plan',
    ],
    accent: '#9B78FF',
    glow: 'rgba(155, 120, 255, 0.18)',
  },
  MAJOR_APPLICATION_READINESS: {
    number: '03',
    category: 'Major decision',
    outcome: 'Prepare the timing and credit activity around one important upcoming application.',
    includes: ['Application-specific assessment', 'Timing recommendation', 'Preparation checklist'],
    accent: '#36D399',
    glow: 'rgba(54, 211, 153, 0.16)',
  },
};
const purchaseStatus: Record<
  string,
  { label: string; color: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  PENDING: { label: 'Payment pending', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  FAILED: { label: 'Payment failed', color: 'error' },
  REFUNDED: { label: 'Refunded', color: 'info' },
  CANCELLED: { label: 'Cancelled', color: 'default' },
};
export function ServicesPage() {
  const query = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest<Data>('/api/services'),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError || !query.data) return <Alert severity="error">Unable to load services.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Services"
        title="Services"
        description="Choose expert guidance for your next credit decision and review every previous purchase."
      />
      <Box>
        <Typography variant="overline" color="primary">
          Available services
        </Typography>
        <Typography variant="h3">Choose the support you need</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Each service is purchased independently. A current Credit Profile is required before
          Credit Applications or Credit Readiness can advance.
        </Typography>
      </Box>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        {query.data.catalog.map((service) => {
          const Icon = icons[service.serviceType];
          const presentation = servicePresentation[service.serviceType];
          const review = service.serviceType === 'CREDIT_PROFILE_REVIEW';
          return (
            <SectionCard
              key={service.serviceType}
              variant="standard"
              sx={{
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderColor: `${presentation.accent}55`,
                background: `radial-gradient(circle at 100% 0%, ${presentation.glow}, transparent 42%), ${designTokens.color.surface}`,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  bgcolor: presentation.accent,
                },
              }}
            >
              <Stack spacing={2.5} sx={{ height: '100%', position: 'relative' }}>
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: presentation.glow,
                      color: presentation.accent,
                      border: '1px solid',
                      borderColor: `${presentation.accent}66`,
                    }}
                  >
                    <Icon />
                  </Box>
                  <Typography
                    sx={{ ml: 'auto', color: presentation.accent, fontWeight: 900, fontSize: 18 }}
                  >
                    {presentation.number}
                  </Typography>
                </Stack>
                <Box>
                  <Chip
                    size="small"
                    label={presentation.category}
                    sx={{
                      mb: 1.5,
                      color: presentation.accent,
                      borderColor: `${presentation.accent}66`,
                    }}
                    variant="outlined"
                  />
                  <Typography variant="h4">{serviceNames[service.serviceType]}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                    {presentation.outcome}
                  </Typography>
                </Box>
                <Stack spacing={1.1}>
                  {presentation.includes.map((item) => (
                    <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CheckCircleRounded sx={{ color: presentation.accent, fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Box
                  sx={{
                    mt: { xs: '24px !important', lg: 'auto !important' },
                    pt: 2,
                    borderTop: '1px solid',
                    borderColor: `${presentation.accent}3D`,
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }}
                    spacing={1.25}
                    sx={{
                      alignItems: {
                        xs: 'flex-start',
                        sm: 'center',
                        lg: 'flex-start',
                        xl: 'center',
                      },
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="overline"
                        sx={{ color: presentation.accent, lineHeight: 1.2 }}
                      >
                        Eligibility
                      </Typography>
                      <Typography sx={{ mt: 0.25, fontWeight: 850 }}>
                        {review ? 'Credit Profile not current' : 'Current Credit Profile required'}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label="Checkout coming soon"
                      sx={{
                        flexShrink: 0,
                        bgcolor: presentation.glow,
                        color: presentation.accent,
                        fontWeight: 800,
                      }}
                    />
                  </Stack>
                </Box>
              </Stack>
            </SectionCard>
          );
        })}
      </Box>
      <SectionCard>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Purchase history
            </Typography>
            <Typography variant="h3">Previous purchases</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Every service purchase remains available here, including completed, pending, refunded,
              and cancelled transactions.
            </Typography>
          </Box>
          {query.data.purchases.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800 }}>No purchases yet</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Your complete service purchase history will appear here.
              </Typography>
            </Paper>
          ) : (
            query.data.purchases.map((purchase) => (
              <Paper key={purchase.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 850 }}>
                      {serviceNames[purchase.serviceType]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Purchased{' '}
                      {new Date(purchase.purchasedAt ?? purchase.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 800 }}>
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: purchase.currency,
                      }).format(purchase.amount)}
                    </Typography>
                    <Chip
                      size="small"
                      color={purchaseStatus[purchase.status]?.color ?? 'default'}
                      label={purchaseStatus[purchase.status]?.label ?? purchase.status}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
