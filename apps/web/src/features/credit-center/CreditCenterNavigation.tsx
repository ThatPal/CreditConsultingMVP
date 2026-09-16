import { rememberCreditCenterHub } from './hubPosition';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';

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
  const [open, setOpen] = useState(false);
  const [search] = useSearchParams();
  const review = search.get('review');
  const path = (id: CreditCenterArea) =>
    creditCenterPath(id) + (review ? '?review=' + encodeURIComponent(review) : '');
  if (!wide)
    return (
      <>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          SECTION
        </Typography>
        <Button
          fullWidth
          aria-label={
            'Credit Center section: ' + creditCenterAreas.find((a) => a.id === area)!.title
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          endIcon={<ExpandMoreRounded />}
          sx={{
            height: 50,
            px: 2,
            justifyContent: 'space-between',
            border: 1,
            borderColor: (t) => alpha(t.palette.primary.main, 0.24),
            borderRadius: 1.5,
            color: 'text.primary',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          }}
        >
          {creditCenterAreas.find((a) => a.id === area)!.title}
        </Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          aria-labelledby="credit-center-area-title"
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                position: 'fixed',
                bottom: 0,
                m: 0,
                width: '100%',
                maxHeight: '85dvh',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                backgroundImage: 'none',
              },
            },
          }}
        >
          <DialogTitle id="credit-center-area-title">Go to</DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box component="nav" aria-label="Credit Center areas">
              {creditCenterAreas.map(({ id, title, icon: Icon }) => (
                <ButtonBase
                  key={id}
                  component={Link}
                  to={path(id)}
                  aria-current={id === area ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  sx={{
                    width: '100%',
                    px: 3,
                    py: 1.75,
                    gap: 2,
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: id === area ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>{title}</Typography>
                  {id === area && (
                    <CheckRounded color="primary" fontSize="small" aria-label="Selected area" />
                  )}
                </ButtonBase>
              ))}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button fullWidth onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </>
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
          to={path(id)}
          aria-current={id === area ? 'page' : undefined}
          sx={{
            px: 2.5,
            py: 1.75,
            position: 'relative',
            borderRadius: '8px 8px 0 0',
            fontWeight: id === area ? 700 : 500,
            bgcolor: id === area ? (t) => alpha(t.palette.primary.main, 0.07) : 'transparent',
            color: id === area ? 'primary.light' : 'text.secondary',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -1,
              left: 16,
              right: 16,
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: id === area ? 'primary.main' : 'transparent',
            },
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: 'text.primary',
            },
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
