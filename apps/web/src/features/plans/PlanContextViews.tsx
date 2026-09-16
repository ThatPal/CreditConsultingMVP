import HistoryRounded from '@mui/icons-material/HistoryRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
export type PlanDecisionRead = {
  id: string;
  title: string;
  explanation: string;
  publishedAt: string;
  historical: boolean;
  href: string;
  sourceLabel: string;
};
export function PlanDecisions({ decisions }: { decisions: PlanDecisionRead[] }) {
  return (
    <Stack component="section" aria-label="Published decisions" spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <HistoryRounded color="primary" />
        <Typography variant="h2">Decisions and recommendations</Typography>
      </Stack>
      <Typography color="text.secondary">
        Published guidance from your Credit Reviews and Major Readiness coordination. These records
        explain what was decided then; your current focus tells you what to do now.
      </Typography>
      {!decisions.length && (
        <Typography>
          No published recommendations or coordination decisions are available yet.
        </Typography>
      )}
      <Stack component="ol" spacing={3} sx={{ pl: 3, m: 0 }}>
        {decisions.map((decision) => (
          <Box
            component="li"
            key={decision.id}
            sx={{ pl: 1, borderBottom: 1, borderColor: 'divider', pb: 3 }}
          >
            <Typography variant="overline" color="text.secondary">
              {new Date(decision.publishedAt).toLocaleDateString()} ·{' '}
              {decision.historical ? 'Saved publication' : 'Current decision'}
            </Typography>
            <Typography variant="h3">{decision.title}</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{decision.explanation}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {decision.sourceLabel}
            </Typography>
            <Button component={Link} to={decision.href}>
              View source context
            </Button>
          </Box>
        ))}
      </Stack>
      {!!decisions.length && (
        <Typography variant="caption" color="text.secondary">
          Showing up to 20 published Review recommendations and 20 coordination decisions. Source
          pages retain their own history.
        </Typography>
      )}
    </Stack>
  );
}
