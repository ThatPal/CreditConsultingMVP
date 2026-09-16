import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import ManageSearchOutlined from '@mui/icons-material/ManageSearchOutlined';
import ReportOutlined from '@mui/icons-material/ReportOutlined';
import { PublishedScoreGauge, PublishedUtilizationRing } from './PublishedCreditVisuals';
import { designTokens } from '../../theme';
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
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        p: { xs: 2.5, md: 4 },
        background: designTokens.gradient.data,
        boxShadow: designTokens.shadow.glow,
      }}
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
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            {bureaus.map(([key, label]) => (
              <PublishedScoreGauge key={key} value={number(profile[key])} bureau={label} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Common reference scale: 300–850, lower to higher. Your scoring model was not supplied;
            its range and rating bands may differ. These are published scores, not lending
            decisions.
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <PublishedUtilizationRing value={utilization} />
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
        {facts.map(([key, label], index) => (
          <Box key={key} sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
            <Box aria-hidden="true" sx={{ color: 'primary.main', mb: 1.5 }}>
              {
                [
                  <AccountBalanceWalletOutlined key="balance" />,
                  <CreditCardOutlined key="limit" />,
                  <AccountBalanceOutlined key="accounts" />,
                  <ManageSearchOutlined key="inquiries" />,
                  <ReportOutlined key="items" />,
                ][index]
              }
            </Box>
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
