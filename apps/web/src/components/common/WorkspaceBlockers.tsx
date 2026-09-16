import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { WorkspaceBlockerRead } from '../../queries/creditWorkspace';
export function WorkspaceBlockers({ blockers }: { blockers?: WorkspaceBlockerRead[] | undefined }) {
  if (!blockers?.length) return null;
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        background: 'transparent',
        borderBlock: 1,
        borderColor: 'divider',
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Typography component="h2" sx={{ fontWeight: 700 }}>
          Waiting and restrictions · {blockers.length}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack component="ul" spacing={2} sx={{ m: 0, pl: 2 }}>
          {blockers.map((blocker, index) => (
            <Stack component="li" key={index} spacing={0.5} sx={{ display: 'list-item' }}>
              {blocker.title && <Typography sx={{ fontWeight: 700 }}>{blocker.title}</Typography>}
              <Typography>{blocker.message}</Typography>
              {blocker.owner && (
                <Typography variant="body2" color="text.secondary">
                  Next step ·{' '}
                  {blocker.owner === 'CLIENT'
                    ? 'You'
                    : blocker.owner === 'CONSULTANT'
                      ? 'Your consultant'
                      : 'Automated check'}
                </Typography>
              )}
              {blocker.href && (
                <Button component={Link} to={blocker.href}>
                  View related step
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
