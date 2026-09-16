import { ProfileEvidence } from './ProfileEvidence';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { Link } from 'react-router-dom';
import { BureauScoreGallery, CreditDataValue, UtilizationCapacity } from './CreditData';
import { type CreditExperience, unknownValue } from './data';

export function CreditProfile({ data }: { data: CreditExperience }) {
  const sections = [
    {
      id: 'accounts',
      title: 'Accounts & credit mix',
      keys: [
        ['openAccounts', 'Open accounts'],
        ['closedAccounts', 'Closed accounts'],
        ['revolvingAccounts', 'Revolving accounts'],
        ['installmentAccounts', 'Installment accounts'],
      ],
    },
    {
      id: 'age',
      title: 'Account age & timing',
      keys: [
        ['oldestAccountAgeMonths', 'Oldest account · months'],
        ['averageAccountAgeMonths', 'Average account age · months'],
      ],
    },
    { id: 'payment', title: 'Payment history', keys: [['latePayments', 'Reported late payments']] },
    {
      id: 'inquiries',
      title: 'Hard inquiries',
      keys: [['recentInquiries', 'Reported inquiry count']],
    },
    {
      id: 'negatives',
      title: 'Negative information',
      keys: [
        ['derogatoryItems', 'Reported negative items'],
        ['collections', 'Reported collections'],
      ],
    },
  ] as const;
  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">
        Facts and published calculations from your reviewed report. Your consultant’s interpretation
        lives in Analysis.
      </Typography>
      <Box id="scores">
        <BureauScoreGallery scores={data.scores} />
      </Box>
      <UtilizationCapacity data={data} />
      <Box>
        {sections.map((section) => (
          <Accordion
            key={section.id}
            id={section.id}
            disableGutters
            elevation={0}
            sx={{
              background: 'transparent',
              borderBottom: 1,
              borderColor: 'divider',
              '&:before': { display: 'none' },
              scrollMarginTop: 100,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ py: 1 }}>
              <Stack spacing={0.5}>
                <Typography component="h2" variant="h4">
                  {section.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {section.keys
                    .map(([key, label]) =>
                      data.metrics[key]?.value != null
                        ? `${label}: ${data.metrics[key].value?.toLocaleString()} · published summary`
                        : `${label}: not available`,
                    )
                    .join(' · ')}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {section.keys.map(([key, label]) => (
                  <Box key={key}>
                    <Typography variant="overline">{label}</Typography>
                    <CreditDataValue fact={data.metrics[key] ?? unknownValue(label)} />
                  </Box>
                ))}
                <ProfileEvidence data={data} section={section.id} />
                <Button
                  component={Link}
                  to={
                    '/app/credit-center/report#' +
                    (section.id === 'inquiries' || section.id === 'negatives'
                      ? 'inquiries'
                      : 'accounts')
                  }
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Explore report evidence
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
      <Accordion elevation={0} sx={{ background: 'transparent' }}>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <Stack>
            <Typography component="h2" variant="h4">
              Bureau differences
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {data.accounts === null
                ? 'Account-level bureau facts are not available in this report.'
                : 'Compare the reported bureau values below.'}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <ProfileEvidence data={data} section="bureaus" />
          <Typography>
            Scores are shown separately by bureau above. Account presence and balance differences
            require published bureau-specific evidence; a difference is not automatically an error.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
        <Typography variant="h3" component="h2">
          What these facts mean
        </Typography>
        <Typography color="text.secondary">
          Read the interpretation your consultant published with this credit picture.
        </Typography>
        <Button component={Link} to="/app/credit-center/analysis">
          See Analysis
        </Button>
      </Box>
    </Stack>
  );
}
