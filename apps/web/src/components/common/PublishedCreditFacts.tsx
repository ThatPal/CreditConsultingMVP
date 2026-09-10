import { Box, Divider, Grid, Stack, Typography } from '@mui/material';

const bureaus = [
  ['experianScore', 'Experian'],
  ['equifaxScore', 'Equifax'],
  ['transunionScore', 'TransUnion'],
] as const;
const facts = [
  ['revolvingBalance', 'Revolving balance'],
  ['revolvingLimit', 'Revolving limit'],
  ['openAccounts', 'Open accounts'],
  ['recentInquiries', 'Recent inquiries'],
  ['derogatoryItems', 'Derogatory items'],
] as const;
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Published facts only. Do not infer a scoring model, rating, or missing bureau. */
export function PublishedCreditFacts({
  profile,
  reportDate,
  publishedAt,
}: {
  profile: Record<string, unknown>;
  reportDate?: string | null;
  publishedAt: string;
}) {
  const utilization = number(profile.aggregateUtilization);
  return (
    <Box
      component="section"
      aria-label="Published credit facts"
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 3 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ justifyContent: 'space-between', mb: 3 }}
      >
        <Typography variant="h3">Your credit picture</Typography>
        <Typography variant="body2" color="text.secondary">
          {reportDate
            ? `Report dated ${new Date(reportDate).toLocaleDateString()}`
            : 'Report date unavailable'}{' '}
          · Published {new Date(publishedAt).toLocaleDateString()}
        </Typography>
      </Stack>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scores in your published profile
          </Typography>
          <Box
            component="dl"
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', m: 0, gap: 2 }}
          >
            {bureaus.map(([key, label]) => (
              <Box key={key}>
                <Typography component="dt" variant="body2">
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{
                    m: 0,
                    mt: 1,
                    fontSize: number(profile[key]) === null ? 16 : { xs: 32, sm: 42 },
                    fontWeight: 500,
                    letterSpacing: '-0.035em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {number(profile[key]) ?? 'Not reported'}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Scores may differ by bureau and scoring model. No score model was supplied with these
            published facts.
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2">Revolving credit utilization</Typography>
            <Typography
              sx={{
                fontSize: 36,
                lineHeight: 1.2,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {utilization === null ? 'Not reported' : `${utilization.toLocaleString()}%`}
            </Typography>
            {utilization !== null && (
              <Box
                role="img"
                aria-label={`Credit utilization ${utilization} percent`}
                sx={{ height: 10, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}
              >
                <Box
                  sx={{
                    width: `${Math.max(0, Math.min(100, utilization))}%`,
                    height: '100%',
                    bgcolor: '#76b5a4',
                  }}
                />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              The share of revolving credit in use in this published profile.
            </Typography>
          </Stack>
        </Grid>
      </Grid>
      <Divider sx={{ my: 3 }} />
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
          m: 0,
          gap: 3,
        }}
      >
        {facts.map(([key, label]) => (
          <Box key={key}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="dd"
              sx={{ m: 0, mt: 0.5, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
            >
              {number(profile[key]) === null
                ? 'Not reported'
                : `${key.startsWith('revolving') ? '$' : ''}${number(profile[key])!.toLocaleString()}`}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
