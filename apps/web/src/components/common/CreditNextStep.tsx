import { FocusOwner } from './FocusOwner';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import NearMeRounded from '@mui/icons-material/NearMeRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { designTokens } from '../../theme';
import type { CreditWorkspaceRead } from '../../queries/creditWorkspace';
export function CreditNextStep({ workspace }: { workspace: CreditWorkspaceRead }) {
  return (
    <Stack
      component="section"
      aria-label="Your next step"
      spacing={2}
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: '24px',
        border: 1,
        borderColor: 'divider',
        background: designTokens.gradient.focus,
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <NearMeRounded sx={{ color: 'primary.main' }} />
        <Typography variant="overline">Your next step</Typography>
      </Stack>
      <FocusOwner owner={workspace.currentFocus.owner} />
      <Box>
        <Typography variant="h3" component="h2">
          {workspace.currentFocus.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          {workspace.currentFocus.detail}
        </Typography>
      </Box>
      <Typography variant="body2">
        Actions remaining: {workspace.plan.openActionCount} · {workspace.plan.completedActionCount}{' '}
        completed
      </Typography>
      <Button
        component={Link}
        to={workspace.currentFocus.action}
        endIcon={<ArrowForwardRounded />}
        variant="contained"
        sx={{ alignSelf: 'flex-start' }}
      >
        {workspace.currentFocus.actionLabel}
      </Button>
    </Stack>
  );
}
