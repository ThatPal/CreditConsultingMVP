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
export type PublishedFindingStory = {
  code: string;
  title: string;
  summary: string;
  severity: string;
  whyItMatters?: string;
  historicalContext?: string;
  goalRelevance?: string;
  supportingFacts?: Array<{
    label: string;
    value: string;
    area: 'profile' | 'report';
    section: string;
  }>;
  relatedPlanItems?: Array<{ id: string; title: string }>;
};
/** Professional meaning must arrive as published client-safe content, never inferred here. */
export function AnalysisFinding({ finding }: { finding: PublishedFindingStory }) {
  return (
    <Box
      component="article"
      id={'finding-' + finding.code}
      sx={{ py: 3, borderBottom: 1, borderColor: '#c6d3cb', scrollMarginTop: 100 }}
    >
      <Typography variant="overline">
        Published finding · {finding.severity.replaceAll('_', ' ').toLowerCase()}
      </Typography>
      <Typography variant="h3" sx={{ mt: 1 }}>
        {finding.title}
      </Typography>
      <Typography sx={{ mt: 1, maxWidth: 800, lineHeight: 1.8 }}>{finding.summary}</Typography>
      {finding.whyItMatters && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h4" component="h4">
            Why it matters
          </Typography>
          <Typography sx={{ mt: 1 }}>{finding.whyItMatters}</Typography>
        </Box>
      )}
      {finding.supportingFacts?.length ||
      finding.historicalContext ||
      finding.goalRelevance ||
      finding.relatedPlanItems?.length ? (
        <Accordion
          elevation={0}
          sx={{ background: 'transparent', color: 'inherit', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ color: 'inherit' }} />}>
            <Typography>Evidence & related work</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {finding.supportingFacts?.map((f, i) => (
                <Box key={i}>
                  <Typography>
                    {f.label} · {f.value}
                  </Typography>
                  <Button
                    component={Link}
                    to={'/app/credit-center/' + f.area + '#' + encodeURIComponent(f.section)}
                  >
                    View {f.label.toLowerCase()}
                  </Button>
                </Box>
              ))}
              {finding.historicalContext && <Typography>{finding.historicalContext}</Typography>}
              {finding.goalRelevance && <Typography>{finding.goalRelevance}</Typography>}
              {finding.relatedPlanItems?.map((p) => (
                <Button
                  key={p.id}
                  component={Link}
                  to={'/app/credit-center/plan?item=' + encodeURIComponent(p.id)}
                >
                  Plan · {p.title}
                </Button>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : (
        <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>
          Specific account and Plan-item relationships were not included with this finding.
        </Typography>
      )}
      <Stack direction="row" sx={{ flexWrap: 'wrap', mt: 1 }}>
        <Button component={Link} to="/app/credit-center/profile">
          Explore supporting Profile facts
        </Button>
        <Button component={Link} to="/app/credit-center/report">
          View report evidence
        </Button>
      </Stack>
    </Box>
  );
}
