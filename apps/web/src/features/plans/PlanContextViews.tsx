import HistoryRounded from '@mui/icons-material/HistoryRounded';
import SpaRounded from '@mui/icons-material/SpaRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { PlanRoadmap } from './PlanRoadmap';
import type { ClientPlanItem } from '../../pages/PlanPages';
export type PlanDecisionRead = {
  id: string;
  title: string;
  explanation: string;
  publishedAt: string;
  historical: boolean;
  href: string;
  sourceLabel: string;
};
export function PlanViews({ view }: { view: string }) {
  return (
    <Stack
      component="nav"
      aria-label="Credit Plan views"
      direction="row"
      sx={{ gap: 1, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}
    >
      {[
        ['overview', 'Overview'],
        ['actions', 'Actions'],
        ['guidance', 'Guidance'],
        ['decisions', 'Decisions'],
        ['nurture', 'Nurture'],
      ].map(([key, label]) => (
        <Button
          key={key}
          component={Link}
          to={key === 'overview' ? '/app/plan' : '/app/plan?view=' + key}
          aria-current={view === key ? 'page' : undefined}
          sx={{
            borderRadius: 0,
            borderBottom: 2,
            borderColor: view === key ? 'primary.main' : 'transparent',
          }}
        >
          {label}
        </Button>
      ))}
    </Stack>
  );
}
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
export function PlanNurture({ active, items }: { active: boolean; items: ClientPlanItem[] }) {
  return (
    <Stack component="section" aria-label="Nurture guidance" spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <SpaRounded color="primary" />
        <Typography variant="h2">Your longer-term guidance</Typography>
      </Stack>
      <Typography color="text.secondary">
        Nurture is the ongoing work and timing your consultant has published to support your
        longer-term credit goals.
      </Typography>
      {active ? (
        <PlanRoadmap items={items} />
      ) : (
        <Typography>
          No Nurture Plan is currently published. Continue with your current Plan; your consultant
          will publish longer-term guidance when it is appropriate.
        </Typography>
      )}
    </Stack>
  );
}
