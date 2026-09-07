import BookmarkAddRounded from '@mui/icons-material/BookmarkAddRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { RecoveryState } from '../components/common/InteractionPatterns';

export type CatalogProduct = {
  id: string;
  slug: string;
  displayName: string;
  audience: 'PERSONAL' | 'BUSINESS';
  portfolioType: string;
  secured: boolean;
  reportsToBureaus: boolean | null;
  tags: string[];
  issuer: { name: string; domain: string | null };
  currentOfferVersion: {
    id: string;
    version: number;
    facts: Record<string, unknown>;
    freshness: 'CURRENT' | 'STALE';
    freshUntil: string | null;
  } | null;
  currentInsightVersion: {
    clientSafeSummary: string;
    strengths: string[];
    cautions: string[];
  } | null;
};

const factsText = (facts: Record<string, unknown>) =>
  Object.entries(facts)
    .filter(([key]) => key !== 'promotionSuppressed')
    .map(
      ([key, value]) =>
        `${key.replace(/([A-Z])/g, ' $1')}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
    )
    .join(' · ');

export function ExploreCardsPage({ consultant = false }: { consultant?: boolean }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const audience = params.get('audience') ?? '';
  const portfolioType = params.get('portfolioType') ?? '';
  const catalogQuery = new URLSearchParams();
  if (search) catalogQuery.set('search', search);
  if (audience) catalogQuery.set('audience', audience);
  if (portfolioType) catalogQuery.set('portfolioType', portfolioType);
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const query = useQuery({
    queryKey: ['card-catalog', search, audience, portfolioType],
    queryFn: () =>
      apiRequest<{ products: CatalogProduct[] }>(`/api/v1/cards/catalog?${catalogQuery}`),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return <RecoveryState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Research"
        title={consultant ? 'Card research' : 'Explore cards'}
        description={
          consultant
            ? 'Compare current governed catalog facts while advising a client. Research does not create a recommendation, eligibility decision, or application.'
            : 'Compare current governed catalog facts. Exploring or saving a card is not a recommendation, eligibility decision, or application.'
        }
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          fullWidth
          value={search}
          onChange={(event) => updateParam('search', event.target.value)}
          placeholder="Search issuer or product"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Card use"
          value={audience}
          onChange={(event) => updateParam('audience', event.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="PERSONAL">Personal</MenuItem>
          <MenuItem value="BUSINESS">Business</MenuItem>
        </TextField>
        <TextField
          select
          label="Portfolio type"
          value={portfolioType}
          onChange={(event) => updateParam('portfolioType', event.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="PERSONAL_CREDIT">Personal credit</MenuItem>
          <MenuItem value="BUSINESS_CREDIT">Business credit</MenuItem>
          <MenuItem value="SECURED">Secured</MenuItem>
          <MenuItem value="NON_REPORTING">Non-reporting</MenuItem>
        </TextField>
      </Stack>
      {!query.data?.products.length ? (
        <Alert severity="info">No catalog products match this search.</Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {query.data.products.map((product) => (
            <ProductCard key={product.id} product={product} consultant={consultant} />
          ))}
        </Box>
      )}
    </Stack>
  );
}

function ProductCard({ product, consultant = false }: { product: CatalogProduct; consultant?: boolean }) {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/client/cards/wishlist/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['card-wishlist'] }),
  });
  return (
    <SectionCard>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4">{product.displayName}</Typography>
            <Typography color="text.secondary">{product.issuer.name}</Typography>
          </Box>
          <CreditCardRounded color="primary" />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip size="small" label={product.audience === 'BUSINESS' ? 'Business' : 'Personal'} />
          <Chip size="small" label={product.portfolioType.replaceAll('_', ' ')} />
          {product.currentOfferVersion?.freshness === 'STALE' && (
            <Chip size="small" color="warning" label="Offer needs refresh" />
          )}
        </Stack>
        <Typography variant="body2">
          {product.currentOfferVersion
            ? factsText(product.currentOfferVersion.facts)
            : 'Current terms unavailable'}
        </Typography>
        {product.currentOfferVersion?.facts.promotionSuppressed === true && (
          <Alert severity="warning">
            Expired promotional details are hidden until the source is refreshed.
          </Alert>
        )}
        {!consultant && (
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to={`/app/cards/${product.id}`} variant="outlined">
              View details
            </Button>
            <Button
              startIcon={<BookmarkAddRounded />}
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save
            </Button>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">
          Research only — there is no Apply action on this surface.
        </Typography>
      </Stack>
    </SectionCard>
  );
}

export function CardWishlistPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['card-wishlist'],
    queryFn: () =>
      apiRequest<{ wishlist: Array<{ id: string; note: string | null; product: CatalogProduct }> }>(
        '/api/v1/client/cards/wishlist',
      ),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/v1/client/cards/wishlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['card-wishlist'] }),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Preferences"
        title="Wishlist"
        description="Saved cards are research preferences only. They are not recommendations, approvals, or Strategy selections."
      />
      {!query.data?.wishlist.length ? (
        <Alert severity="info">
          No saved cards yet. Browse Explore to save products for later research.
        </Alert>
      ) : (
        query.data.wishlist.map(({ id, product, note }) => (
          <SectionCard key={id}>
            <Stack spacing={1}>
              <Typography variant="h4">{product.displayName}</Typography>
              <Typography>{product.issuer.name}</Typography>
              {note && <Typography color="text.secondary">{note}</Typography>}
              <Stack direction="row" spacing={1}>
                <Button component={RouterLink} to={`/app/cards/${product.id}`}>
                  Details
                </Button>
                <Button color="error" onClick={() => remove.mutate(product.id)}>
                  Remove
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        ))
      )}
    </Stack>
  );
}

export function CardDetailPage() {
  const { productId } = useParams();
  const query = useQuery({
    queryKey: ['card-catalog-detail', productId],
    queryFn: async () =>
      (await apiRequest<{ product: CatalogProduct }>(`/api/v1/cards/catalog/${productId}`)).product,
    enabled: Boolean(productId),
  });
  const history = useQuery({
    queryKey: ['card-offer-history', productId],
    queryFn: () =>
      apiRequest<{
        offers: Array<{ id: string; version: number; status: string; publishedAt: string }>;
      }>(`/api/v1/cards/catalog/${productId}/offers`),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <RecoveryState
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/app/cards/explore"
        backLabel="Back to Explore"
      />
    );
  if (!query.data)
    return (
      <RecoveryState
        error={new Error('Card details were not returned')}
        onRetry={() => void query.refetch()}
        backTo="/app/cards/explore"
        backLabel="Back to Explore"
      />
    );
  const product = query.data;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Catalog detail"
        title={product.displayName}
        description={`${product.issuer.name} · governed product identity and current offer facts`}
      />
      <ProductCard product={product} />
      {product.currentInsightVersion && (
        <SectionCard>
          <Typography variant="h4">Approved card intelligence</Typography>
          <Typography sx={{ mt: 1 }}>{product.currentInsightVersion.clientSafeSummary}</Typography>
        </SectionCard>
      )}
      <SectionCard>
        <Typography variant="h4">Offer history</Typography>
        <Stack sx={{ mt: 1 }}>
          {history.data?.offers.map((offer) => (
            <Typography key={offer.id}>
              Version {offer.version} · {offer.status} ·{' '}
              {new Date(offer.publishedAt).toLocaleDateString()}
            </Typography>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function ConsultantClientCardsPage() {
  const { clientId } = useParams();
  const query = useQuery({
    queryKey: ['consultant-client-cards', clientId],
    queryFn: () =>
      apiRequest<{
        cards: Array<{
          id: string;
          cardName: string;
          issuer: string;
          identityStatus: string;
          portfolioType: string;
          cardProduct: { displayName: string } | null;
        }>;
      }>(`/api/v1/consultant/clients/${clientId}/cards`),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return <Alert severity="error">Client cards are unavailable or outside your scope.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Client 360"
        title="Cards"
        description="Current client-owned portfolio with explicit catalog identification state."
      />
      {query.data?.cards.map((card) => (
        <SectionCard key={card.id}>
          <Typography variant="h4">{card.cardName}</Typography>
          <Typography>{card.issuer}</Typography>
          <Chip
            size="small"
            color={card.identityStatus === 'UNRESOLVED' ? 'warning' : 'success'}
            label={
              card.identityStatus === 'UNRESOLVED'
                ? 'Needs identification'
                : `Matched: ${card.cardProduct?.displayName ?? 'catalog product'}`
            }
          />
        </SectionCard>
      ))}
    </Stack>
  );
}

export function CatalogOperationsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['card-catalog-candidates'],
    queryFn: () =>
      apiRequest<{
        candidates: Array<{
          id: string;
          kind: string;
          status: string;
          version: number;
          materialConflict: boolean;
          normalizedPayload: Record<string, unknown>;
          source: { name: string; official: boolean };
          matchedProduct: { displayName: string } | null;
        }>;
      }>('/api/v1/catalog/candidates'),
  });
  const approve = useMutation({
    mutationFn: (candidate: { id: string; version: number }) =>
      apiRequest(`/api/v1/catalog/candidates/${candidate.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: candidate.version,
          reason: 'Reviewed against governed source evidence',
        }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['card-catalog-candidates'] }),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <Alert severity="error">
        Catalog operations are unavailable or your role is not authorized.
      </Alert>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Catalog operations"
        title="Source candidates"
        description="Retrieved and normalized facts remain candidates until an authorized human publishes them."
      />
      {!query.data?.candidates.length ? (
        <Alert severity="info">No candidates require review.</Alert>
      ) : (
        query.data.candidates.map((candidate) => (
          <SectionCard key={candidate.id}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={candidate.status}
                  color={candidate.materialConflict ? 'error' : 'default'}
                />
                <Chip label={candidate.source.official ? 'Official source' : 'Secondary source'} />
              </Stack>
              <Typography variant="h4">
                {String(
                  candidate.normalizedPayload.displayName ??
                    candidate.normalizedPayload.canonicalName ??
                    candidate.kind,
                )}
              </Typography>
              <Typography color="text.secondary">
                {candidate.source.name}
                {candidate.matchedProduct
                  ? ` · matched to ${candidate.matchedProduct.displayName}`
                  : ' · unresolved product identity'}
              </Typography>
              {candidate.materialConflict && (
                <Alert severity="error">
                  A material conflict blocks publication until explicitly resolved.
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={
                  candidate.status === 'APPROVED' || candidate.materialConflict || approve.isPending
                }
                onClick={() => approve.mutate(candidate)}
              >
                Approve and publish
              </Button>
            </Stack>
          </SectionCard>
        ))
      )}
    </Stack>
  );
}

export function InsightOperationsPage({ canApprove = false }: { canApprove?: boolean }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['card-insights'],
    queryFn: () =>
      apiRequest<{
        insights: Array<{
          id: string;
          status: string;
          version: number;
          clientSafeSummary: string;
          internalRationale: string | null;
          confidence: string | null;
          modelProvenance: unknown;
          evidence: unknown;
          product: { displayName: string; issuer: { name: string } };
          offerVersion: { version: number; status: string };
          processDefinition: {
            processKey: string;
            processVersion: number;
            modelProfile: string;
          } | null;
        }>;
      }>('/api/v1/catalog/insights'),
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/v1/catalog/insights/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          note: 'Human review completed',
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['card-insights'] }),
  });
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return <Alert severity="error">CardInsight review is unavailable or unauthorized.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Card intelligence"
        title="Insight review"
        description="AI may prepare structured intelligence, but only authorized professional human review can make it canonical."
      />
      {!query.data?.insights.length ? (
        <Alert severity="info">No insight versions are awaiting review.</Alert>
      ) : (
        query.data.insights.map((insight) => (
          <SectionCard key={insight.id}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={insight.status}
                  color={
                    insight.status === 'STALE'
                      ? 'warning'
                      : insight.status === 'APPROVED'
                        ? 'success'
                        : 'default'
                  }
                />
                <Chip label={`Offer v${insight.offerVersion.version}`} />
              </Stack>
              <Typography variant="h4">{insight.product.displayName}</Typography>
              <Typography>{insight.clientSafeSummary}</Typography>
              {insight.internalRationale && (
                <Typography color="text.secondary">
                  Internal review rationale: {insight.internalRationale}
                </Typography>
              )}
              <Typography variant="caption">
                {insight.processDefinition
                  ? `${insight.processDefinition.processKey} v${insight.processDefinition.processVersion} · ${insight.processDefinition.modelProfile}`
                  : 'Manual preparation'}
              </Typography>
              {canApprove && ['PREPARED', 'IN_REVIEW'].includes(insight.status) && (
                <Button
                  variant="contained"
                  onClick={() => approve.mutate(insight.id)}
                  disabled={approve.isPending}
                >
                  Approve as canonical
                </Button>
              )}
              {!canApprove && ['PREPARED', 'IN_REVIEW'].includes(insight.status) && (
                <Alert severity="info">
                  Admin can inspect operations, but professional approval requires the consultant
                  catalog-intelligence authority.
                </Alert>
              )}
            </Stack>
          </SectionCard>
        ))
      )}
    </Stack>
  );
}
