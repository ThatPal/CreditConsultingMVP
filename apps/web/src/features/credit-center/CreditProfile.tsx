import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { Link, useLocation } from 'react-router-dom';
import { BureauScoreGallery, CreditDataValue } from './CreditData';
import { ProfileEvidence, observedBureauDifferences } from './ProfileEvidence';
import { ProfileUtilization } from './ProfileUtilization';
import { type CreditExperience, formatReportDate, unknownValue } from './data';
import { theme } from '../../theme';

// Only the score focus area is light; Profile retains the dark structural environment.
const readingTheme = createTheme(theme, {
  palette: {
    mode: 'light',
    primary: { main: '#006c60' },
    background: { paper: '#fbfdfc', default: '#f4f9f7' },
    text: { primary: '#183b37', secondary: '#506d67', disabled: '#728980' },
    divider: '#d5e4de',
    action: { hover: 'rgba(0,108,96,.06)', disabled: '#849c94' },
  },
});
const sections = [
  {
    id: 'accounts',
    title: 'Accounts & credit mix',
    icon: CreditCardOutlined,
    description: 'The accounts included in your published report.',
    keys: [
      ['openAccounts', 'Open accounts'],
      ['revolvingAccounts', 'Revolving'],
      ['installmentAccounts', 'Installment'],
    ],
    href: 'accounts',
  },
  {
    id: 'age',
    title: 'Account age & timing',
    icon: CalendarMonthOutlined,
    description: 'Published ages and reported opening dates.',
    keys: [
      ['oldestAccountAgeMonths', 'Oldest · months'],
      ['averageAccountAgeMonths', 'Average · months'],
    ],
    href: 'accounts',
  },
  {
    id: 'payment',
    title: 'Payment history',
    icon: ScheduleOutlined,
    description: 'Payment information reported by your creditors.',
    keys: [['latePayments', 'Reported late payments']],
    href: 'inquiries',
  },
  {
    id: 'inquiries',
    title: 'Hard inquiries',
    icon: SearchRounded,
    description: 'Published inquiry count; date window not supplied.',
    keys: [['recentInquiries', 'Reported inquiries']],
    href: 'inquiries',
  },
  {
    id: 'negatives',
    title: 'Negative information',
    icon: ReportProblemOutlined,
    description: 'Reported negative items and their source status.',
    keys: [
      ['derogatoryItems', 'Reported negative items'],
      ['collections', 'Collections'],
    ],
    href: 'inquiries',
  },
  {
    id: 'bureaus',
    title: 'Bureau differences',
    icon: CompareArrowsRounded,
    description: 'Observed differences are not automatically errors.',
    keys: [],
    href: 'accounts',
  },
] as const;

export function CreditProfile({
  data,
  reportDate = null,
  publishedAt = null,
}: {
  data: CreditExperience;
  reportDate?: string | null;
  publishedAt?: string | null;
}) {
  const { hash } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const id = hash.slice(1);
    if (!['scores', 'utilization', 'factors', ...sections.map((s) => s.id)].includes(id)) return;
    setExpanded((old) => ({ ...old, [id]: true }));
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById('profile-heading-' + id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  const hasFactors = data.scores.some((s) => s.factors.length > 0);
  const differences = observedBureauDifferences(data.accounts);
  const hasNegatives =
    data.negatives !== null ||
    ['derogatoryItems', 'collections'].some((key) => {
      const fact = data.metrics[key];
      return (
        fact?.value !== null &&
        fact?.value !== undefined &&
        ['KNOWN', 'PARTIAL'].includes(fact.quality)
      );
    });
  const visibleSections = sections.filter(
    (s) => (s.id !== 'negatives' || hasNegatives) && (s.id !== 'bureaus' || differences.length > 0),
  );
  const disclosureStyle = {
    bgcolor: 'transparent',
    '&:before': { display: 'none' },
    borderBottom: 1,
    borderColor: 'divider',
    borderRadius: '0 !important',
  };
  return (
    <>
      <Box
        component="article"
        aria-label="Credit Profile"
        sx={{
          color: 'text.primary',
          minWidth: 0,
        }}
      >
        <Stack spacing={1} sx={{ pt: 1, pb: 3 }}>
          <Typography variant="h2" component="h2">
            Credit Profile
          </Typography>
          <Typography color="text.secondary">
            A structured view of the facts in your latest reviewed report.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Reported {formatReportDate(reportDate)} · Published {formatReportDate(publishedAt)}
          </Typography>
        </Stack>
        <Box id="scores" tabIndex={-1} sx={{ scrollMarginTop: 100 }}>
          <Box id="profile-heading-scores" tabIndex={-1} sx={{ scrollMarginTop: 100 }}>
            <ThemeProvider theme={readingTheme}>
              <BureauScoreGallery scores={data.scores} profile />
            </ThemeProvider>
          </Box>
        </Box>
        <ProfileUtilization data={data} />
        <Box sx={{ mt: 3 }}>
          {visibleSections.map(({ id, title, icon: Icon, description, keys, href }) => (
            <Accordion
              key={id}
              id={id}
              disableGutters
              elevation={0}
              expanded={!!expanded[id]}
              onChange={(_, open) => setExpanded((old) => ({ ...old, [id]: open }))}
              sx={disclosureStyle}
            >
              <AccordionSummary
                id={'profile-heading-' + id}
                aria-controls={'profile-body-' + id}
                expandIcon={<ExpandMoreRounded />}
                sx={{
                  px: { xs: 1.5, md: 2 },
                  py: 1.5,
                  scrollMarginTop: 100,
                  '& .MuiAccordionSummary-content': {
                    gap: 2,
                    minWidth: 0,
                    alignItems: 'flex-start',
                  },
                }}
              >
                <Icon sx={{ color: 'primary.main', mt: 0.4, fontSize: 23, flexShrink: 0 }} />
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: { md: 'grid' },
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 2,
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography
                      component="h3"
                      sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 700 }}
                    >
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {id === 'inquiries'
                        ? (data.inquiryWindow ?? description)
                        : id === 'payment'
                          ? (data.paymentSummary ?? description)
                          : description}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ flexWrap: 'wrap', gap: { xs: 2, md: 4 }, mt: { xs: 1.5, md: 0 } }}
                  >
                    {keys.map(([key, label]) => {
                      const fact = data.metrics[key] ?? unknownValue(label);
                      const available =
                        fact.value !== null && ['KNOWN', 'PARTIAL'].includes(fact.quality);
                      return (
                        <Box key={key}>
                          <Typography sx={{ fontWeight: 700, fontSize: available ? 20 : 13 }}>
                            {available
                              ? fact.value!.toLocaleString()
                              : fact.quality === 'NOT_APPLICABLE'
                                ? 'Not applicable'
                                : 'Not available'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {label}
                            {fact.quality === 'PARTIAL' ? ' · partial' : ''}
                          </Typography>
                        </Box>
                      );
                    })}
                    {id === 'bureaus' && (
                      <Typography variant="caption" color="text.secondary">
                        {differences.length} {differences.length === 1 ? 'account' : 'accounts'}{' '}
                        with observed bureau differences
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </AccordionSummary>
              <AccordionDetails id={'profile-body-' + id} sx={{ px: { xs: 2.5, md: 7 }, pb: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
                    {keys.map(([key, label]) => (
                      <Box key={key}>
                        <Typography variant="caption">{label}</Typography>
                        <CreditDataValue fact={data.metrics[key] ?? unknownValue(label)} />
                      </Box>
                    ))}
                  </Stack>
                  {id === 'accounts' && (
                    <Box>
                      <Typography variant="caption">Closed accounts</Typography>
                      <CreditDataValue
                        fact={data.metrics.closedAccounts ?? unknownValue('Closed accounts')}
                      />
                    </Box>
                  )}
                  <ProfileEvidence data={data} section={id} />
                  <Button
                    component={Link}
                    to={'/app/credit-center/report#' + href}
                    endIcon={<ArrowForwardRounded />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    View report evidence
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
          {hasFactors && (
            <Accordion
              id="factors"
              disableGutters
              elevation={0}
              expanded={!!expanded.factors}
              onChange={(_, open) => setExpanded((old) => ({ ...old, factors: open }))}
              sx={disclosureStyle}
            >
              <AccordionSummary
                id="profile-heading-factors"
                aria-controls="profile-body-factors"
                expandIcon={<ExpandMoreRounded />}
                sx={{ py: 2, gap: 2, scrollMarginTop: 100 }}
              >
                <BarChartRounded sx={{ mr: 2, color: 'primary.main' }} />
                <Typography component="h3" sx={{ fontWeight: 700 }}>
                  Factors included with your score ·{' '}
                  {data.scores.reduce((n, s) => n + s.factors.length, 0)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails id="profile-body-factors">
                {data.scores
                  .filter((s) => s.factors.length)
                  .map((s) => (
                    <Box key={s.bureau} sx={{ mb: 2 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {s.bureau} · {s.model ?? 'Model not supplied'} · {formatReportDate(s.date)}
                      </Typography>
                      <Box component="ul">
                        {s.factors.map((f, i) => (
                          <Typography component="li" key={i}>
                            {f}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
        {!hasNegatives && (
          <Typography
            id="profile-heading-negatives"
            tabIndex={-1}
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2, scrollMarginTop: 100 }}
          >
            Negative-item details are not available in this publication.
          </Typography>
        )}
        {!differences.length && (
          <Typography
            id="profile-heading-bureaus"
            tabIndex={-1}
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2, scrollMarginTop: 100 }}
          >
            {data.accounts === null
              ? 'Bureau-specific account comparisons are not available in this publication.'
              : 'No differences were identified in the available comparable bureau facts. Missing bureau inputs are not compared.'}
          </Typography>
        )}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            py: 3,
            mt: 3,
            gap: 2,
            alignItems: { md: 'center' },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography component="h3" sx={{ fontWeight: 700 }}>
              The evidence and the interpretation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Explore the source in Report Details, or read your consultant’s published
              interpretation in Analysis.
            </Typography>
          </Box>
          <Button component={Link} to="/app/credit-center/report" variant="outlined">
            Report Details
          </Button>
          <Button
            component={Link}
            to="/app/credit-center/analysis"
            endIcon={<ArrowForwardRounded />}
          >
            See Analysis
          </Button>
        </Stack>
      </Box>
    </>
  );
}
