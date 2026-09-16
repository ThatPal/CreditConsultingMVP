import { rememberCreditCenterHub } from './hubPosition';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import { Box, Button, ButtonBase, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';

export const creditCenterAreas = [
  {
    id: 'overview',
    title: 'Overview',
    detail: 'Your credit picture in context.',
    icon: CreditScoreRounded,
  },
  {
    id: 'profile',
    title: 'Credit Profile',
    detail: 'Understand the facts shaping your credit.',
    icon: CreditScoreRounded,
  },
  {
    id: 'report',
    title: 'Report Details',
    detail: 'Browse what is actually on your report.',
    icon: ArticleOutlined,
  },
  {
    id: 'analysis',
    title: 'Analysis',
    detail: 'See what your consultant identified and why.',
    icon: InsightsRounded,
  },
  {
    id: 'plan',
    title: 'Plan',
    detail: 'Know what to do now and what comes next.',
    icon: RouteRounded,
  },
  {
    id: 'history',
    title: 'History',
    detail: 'Explore how your credit picture has changed.',
    icon: HistoryRounded,
  },
] as const;
export type CreditCenterArea = (typeof creditCenterAreas)[number]['id'];
export const creditCenterPath = (area: CreditCenterArea) =>
  '/app/credit-center' + (area === 'overview' ? '' : '/' + area);

export function CreditCenterNavigation({ area }: { area: CreditCenterArea }) {
  const wide = useMediaQuery(useTheme().breakpoints.up('lg'));
  if (!wide)
    return area === 'overview' ? null : (
      <Button
        component={Link}
        to={creditCenterPath('overview')}
        state={{ restoreCreditCenter: true }}
        startIcon={<ArrowBackRounded />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Credit Center
      </Button>
    );
  return (
    <Stack
      component="nav"
      aria-label="Credit Center sections"
      direction="row"
      sx={{ borderBottom: 1, borderColor: 'divider', gap: 0.5 }}
    >
      {creditCenterAreas.map(({ id, title }) => (
        <Button
          key={id}
          component={Link}
          to={creditCenterPath(id)}
          aria-current={id === area ? 'page' : undefined}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 0,
            borderBottom: 2,
            borderColor: id === area ? 'primary.main' : 'transparent',
            color: id === area ? 'primary.main' : 'text.secondary',
          }}
        >
          {title}
        </Button>
      ))}
    </Stack>
  );
}

export function CreditCenterDestinations() {
  return (
    <Box component="nav" aria-label="Explore your Credit Center">
      <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
        Explore your Credit Center
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {creditCenterAreas
          .filter((x) => x.id !== 'overview')
          .map(({ id, title, detail, icon: Icon }) => (
            <ButtonBase
              key={id}
              component={Link}
              to={creditCenterPath(id)}
              onClick={rememberCreditCenterHub}
              sx={{
                p: 2.5,
                justifyContent: 'flex-start',
                textAlign: 'left',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                gap: 2,
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
              }}
            >
              <Icon sx={{ color: 'primary.main' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {detail}
                </Typography>
              </Box>
              <ArrowForwardRounded fontSize="small" />
            </ButtonBase>
          ))}
      </Box>
    </Box>
  );
}
