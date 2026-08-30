import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import {
  Alert,
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { designTokens } from '../theme';

type ClientCard = {
  id: string;
  cardName: string;
  issuer: string;
  scope: 'PERSONAL' | 'BUSINESS';
  creditLimit: number | null;
  balance: number | null;
  accountStatus: 'OPEN' | 'CLOSED' | null;
  applicationOutcome: 'APPROVED' | 'DECLINED' | 'PENDING' | null;
  applicationSource: 'CLIENT' | 'CONSULTANT' | null;
  appliedAt: string | null;
};
type Filter = 'ALL' | 'OPEN' | 'CLOSED' | 'APPLICATIONS';

const money = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);

export function CardsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const query = useQuery({
    queryKey: ['client-cards'],
    queryFn: () =>
      apiRequest<{
        cards: ClientCard[];
        reviewSource: {
          reviewId: string;
          reviewDate: string;
          status: string;
          verified: boolean;
        } | null;
      }>('/api/v1/client/cards'),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError || !query.data)
    return <Alert severity="error">Unable to load your cards.</Alert>;

  const cards = query.data.cards;
  const filtered = cards.filter((card) => {
    if (filter === 'OPEN') return card.accountStatus === 'OPEN';
    if (filter === 'CLOSED') return card.accountStatus === 'CLOSED';
    if (filter === 'APPLICATIONS') return Boolean(card.applicationOutcome);
    return true;
  });
  const openCards = cards.filter((card) => card.accountStatus === 'OPEN');
  const totalLimit = openCards.reduce((sum, card) => sum + (card.creditLimit ?? 0), 0);
  const totalBalance = openCards.reduce((sum, card) => sum + (card.balance ?? 0), 0);
  const utilization = totalLimit ? (totalBalance / totalLimit) * 100 : 0;

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Portfolio"
        title="Your cards"
        description="One catalog for current and closed cards, application results, and how each application was submitted."
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <MetricCard
          label="Open cards"
          value={String(openCards.length)}
          supportingText="Active accounts"
        />
        <MetricCard label="Total limit" value={money(totalLimit)} supportingText="Open cards" />
        <MetricCard label="Total balance" value={money(totalBalance)} supportingText="Open cards" />
        <MetricCard
          label="Utilization"
          value={`${utilization.toFixed(1)}%`}
          supportingText="Across open cards"
        />
      </Box>
      <Alert
        severity={query.data.reviewSource?.verified ? 'success' : 'info'}
        icon={<CalendarMonthRounded />}
        sx={{ alignItems: 'center' }}
      >
        {query.data.reviewSource ? (
          <>
            <Typography sx={{ fontWeight: 850 }}>
              Card information current from Review dated{' '}
              {new Date(query.data.reviewSource.reviewDate).toLocaleDateString()}
            </Typography>
            <Typography variant="body2">
              This information comes from your most recent Credit Profile Review.
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontWeight: 850 }}>
              Card information has not been reviewed yet
            </Typography>
            <Typography variant="body2">
              Complete a Credit Profile Review to establish a verified portfolio date.
            </Typography>
          </>
        )}
      </Alert>
      <SectionCard>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' } }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" color="primary">
                Card catalog
              </Typography>
              <Typography variant="h3">All cards and applications</Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={(_, value: Filter | null) => value && setFilter(value)}
              sx={{ alignSelf: { xs: 'stretch', md: 'center' }, overflowX: 'auto' }}
            >
              <ToggleButton value="ALL">All</ToggleButton>
              <ToggleButton value="OPEN">Open</ToggleButton>
              <ToggleButton value="CLOSED">Closed</ToggleButton>
              <ToggleButton value="APPLICATIONS">Applications</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CreditCardRounded color="primary" sx={{ fontSize: 46 }} />
              <Typography variant="h4" sx={{ mt: 1 }}>
                No cards in this view
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Card and application records will appear here when they are added.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {filtered.map((card) => {
                const business = card.scope === 'BUSINESS';
                const declined = card.applicationOutcome === 'DECLINED';
                return (
                  <Box
                    key={card.id}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: declined ? 'error.dark' : 'divider',
                      background: declined
                        ? 'linear-gradient(145deg, rgba(239,83,80,.10), rgba(16,24,44,.92))'
                        : designTokens.gradient.subtle,
                    }}
                  >
                    <Stack spacing={2.25}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: business ? 'rgba(155,120,255,.16)' : 'rgba(66,211,242,.14)',
                            color: business ? 'secondary.light' : 'primary.main',
                          }}
                        >
                          {business ? <BusinessCenterRounded /> : <PersonRounded />}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>
                            {card.cardName}
                          </Typography>
                          <Typography color="text.secondary">{card.issuer}</Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={business ? 'Business' : 'Personal'}
                        />
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Limit
                          </Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                            {money(card.creditLimit)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Balance
                          </Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                            {money(card.balance)}
                          </Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {card.accountStatus && (
                          <Chip
                            size="small"
                            color={card.accountStatus === 'OPEN' ? 'success' : 'default'}
                            label={card.accountStatus === 'OPEN' ? 'Open' : 'Closed'}
                          />
                        )}
                        {card.applicationOutcome && (
                          <Chip
                            size="small"
                            color={
                              card.applicationOutcome === 'APPROVED'
                                ? 'success'
                                : card.applicationOutcome === 'DECLINED'
                                  ? 'error'
                                  : 'warning'
                            }
                            label={
                              card.applicationOutcome.charAt(0) +
                              card.applicationOutcome.slice(1).toLowerCase()
                            }
                          />
                        )}
                      </Stack>
                      {card.applicationSource && (
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <AccountBalanceRounded color="primary" sx={{ fontSize: 18 }} />
                          <Typography variant="body2" color="text.secondary">
                            Applied by{' '}
                            {card.applicationSource === 'CLIENT' ? 'client' : 'consultant'}
                            {card.appliedAt
                              ? ` · ${new Date(card.appliedAt).toLocaleDateString()}`
                              : ''}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
