import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import type { ClientPlanItem } from '../../pages/PlanPages';
import { StatusChip } from '../../components/common/StatusChip';
import { presentStatus } from '../../components/common/statusVocabulary';
export const planStepUrl = (item: Pick<ClientPlanItem, 'id' | 'type'>) =>
  '/app/plan?' +
  new URLSearchParams({
    view: item.type === 'ACTION' ? 'actions' : 'guidance',
    item: item.id,
  }).toString();
export function PlanRoadmap({ items }: { items: ClientPlanItem[] }) {
  return (
    <Box component="section" aria-label="Plan roadmap">
      <Typography variant="h2">Your roadmap</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Actions, guidance and milestones in your published Plan. Each step becomes available when
        its own prerequisites are met.
      </Typography>
      {!items.length && <Typography>No steps are included in this published Plan.</Typography>}
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {items.map((item) => (
          <Box
            component="li"
            key={item.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '150px minmax(0,1fr) auto' },
              gap: 2,
              py: 3,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="overline">{item.type.toLowerCase()}</Typography>
              <StatusChip
                {...(item.status === 'UNABLE'
                  ? { label: 'Help requested', tone: 'info' as const }
                  : presentStatus(item.status))}
              />
            </Stack>
            <Stack spacing={1}>
              <Typography variant="h3">{item.title}</Typography>
              <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap', maxWidth: 800 }}>
                {item.body}
              </Typography>
              <Typography variant="caption">
                Owner:{' '}
                {['AWAITING_VERIFICATION', 'UNABLE'].includes(item.status) ||
                item.owner === 'CONSULTANT'
                  ? 'Your consultant'
                  : item.owner === 'SYSTEM'
                    ? 'Automated check'
                    : 'You'}
                {item.dueAt ? ' · ' + new Date(item.dueAt).toLocaleDateString() : ''}
              </Typography>
              {!!item.prerequisites.length && (
                <Typography variant="body2" color="text.secondary">
                  Related prerequisites: {item.prerequisites.map((p) => p.title).join(', ')}
                </Typography>
              )}
            </Stack>
            <Button
              component={Link}
              to={planStepUrl(item)}
              aria-label={'Open step: ' + item.title}
              sx={{ alignSelf: 'center', justifySelf: 'start' }}
            >
              View step
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
