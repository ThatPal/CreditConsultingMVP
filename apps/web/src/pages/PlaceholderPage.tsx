import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { Button, Grid, Stack, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { EmptyState } from '../components/common/Feedback';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

function titleFromPath(path: string) {
  return (
    path
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.split('-')
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(' ') ?? 'Overview'
  );
}

export function PlaceholderPage() {
  const location = useLocation();
  const title = titleFromPath(location.pathname);
  const consultant = location.pathname.startsWith('/consultant');
  return (
    <Stack spacing={4}>
      <PageHeader
        eyebrow={consultant ? 'Consultant operations' : 'Your strategy'}
        title={title}
        description="This route is ready for its future product sprint. The shell and component system shown here are production foundations—not mock business functionality."
        actions={
          <Button variant="contained" endIcon={<ArrowForwardRounded />}>
            View next step
          </Button>
        }
      />
      <Grid container spacing={2.5}>
        {['Current focus', 'Upcoming', 'Progress'].map((label, index) => (
          <Grid key={label} size={{ xs: 12, sm: 4 }}>
            <MetricCard
              label={label}
              value={index === 0 ? 'Ready' : '—'}
              supportingText="Business data will be connected in a later sprint."
              accent={index === 0 ? 'gradient' : 'info'}
            />
          </Grid>
        ))}
      </Grid>
      <SectionCard variant={consultant ? 'operational' : 'elevated'}>
        <Typography variant="h3">A clear foundation</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
          Navigation, layout, responsive behavior, states, and accessible interaction patterns are
          ready for the domain workflows that follow.
        </Typography>
      </SectionCard>
      <EmptyState
        title={`No ${title.toLowerCase()} activity yet`}
        description="Nothing is missing from your account. This destination will become active when its product sprint is implemented."
        primaryAction={<Button variant="contained">Return to overview</Button>}
      />
    </Stack>
  );
}
