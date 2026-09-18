import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import MapOutlined from '@mui/icons-material/MapOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import { PortalBrand } from './PortalBrand';
import { useAuth } from '../auth/AuthProvider';
import { activeNavigationId, type NavigationItem } from './navigation';
import { portalSurfaces } from '../theme/portalSurfaces';

const portalIcons: Record<string, typeof HomeOutlined> = {
  'portal-home': HomeOutlined,
  'portal-journey': MapOutlined,
  'portal-credit': DescriptionOutlined,
  'portal-cards': CreditCardOutlined,
  'portal-services': LayersOutlined,
  'portal-support': ChatBubbleOutlineRounded,
  'portal-documents': DescriptionOutlined,
  'portal-account': PersonOutlineRounded,
};
// Identical geometry for links and actions; no Button startIcon negative margins.
const rowStyle = {
  width: '100%',
  minHeight: 46,
  display: 'flex',
  justifyContent: 'flex-start',
  gap: 1.75,
  px: 2,
  py: 1.25,
  mb: 0.5,
  borderRadius: '8px',
  textAlign: 'left',
  border: '1px solid transparent',
  color: 'text.secondary',
  '&:hover': { background: portalSurfaces.selected },
  '& > svg:first-of-type': { width: 22, height: 22, flexShrink: 0 },
  '& > .MuiTypography-root': { fontSize: 14, fontWeight: 500, flex: 1 },
} as const;

export function SecureWorkspace() {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        p: 2,
        border: 1,
        borderColor: portalSurfaces.border,
        borderRadius: '10px',
        background: portalSurfaces.panel,
        alignItems: 'center',
      }}
    >
      <LockOutlined color="primary" />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Secure workspace
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Your strategy stays private.
        </Typography>
      </Box>
    </Stack>
  );
}

/** Client-only navigation; CRM/Admin retain their existing hierarchical drawer. */
export function ClientPortalNavigation({
  items,
  desktop,
}: {
  items: NavigationItem[];
  desktop: boolean;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(false);
  const active = activeNavigationId(items, pathname);
  const primary = items.filter((i) => i.section === 'primary');
  const direct = primary.slice(0, 4);
  const utilities = items.filter((i) => i.section === 'utility');
  const rows = (entries: NavigationItem[]) =>
    entries.map(({ id, path, label, icon }) => {
      const Icon = portalIcons[id] ?? icon;
      return (
        <ButtonBase
          key={id}
          component={Link}
          to={path}
          onClick={() => setOpen(false)}
          aria-current={active === id ? 'page' : undefined}
          sx={{
            ...rowStyle,
            borderColor: active === id ? portalSurfaces.border : 'transparent',
            boxShadow:
              active === id ? 'inset 2px 0 #66d8bd, 0 0 16px rgba(37,207,174,.07)' : 'none',
            color: active === id ? 'text.primary' : 'text.secondary',
            background: active === id ? portalSurfaces.selected : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Icon sx={{ fontSize: 21, color: active === id ? 'primary.main' : 'inherit' }} />
          <Typography variant="body2" sx={{ fontWeight: active === id ? 700 : 500 }}>
            {label}
          </Typography>
          {!desktop && <ChevronRightRounded sx={{ fontSize: 18, opacity: 0.7 }} />}
        </ButtonBase>
      );
    });
  const accountActions = (
    <>
      <ButtonBase
        component={Link}
        to="/app/account/security"
        onClick={() => setOpen(false)}
        sx={rowStyle}
      >
        <SettingsOutlined />
        <Typography>Settings</Typography>
        {!desktop && <ChevronRightRounded sx={{ fontSize: 18, opacity: 0.7 }} />}
      </ButtonBase>
      <ButtonBase
        onClick={async () => {
          try {
            await logout();
            navigate('/login', { replace: true });
          } catch {
            setError(true);
          }
        }}
        sx={rowStyle}
      >
        <LogoutRounded />
        <Typography>Sign Out</Typography>
      </ButtonBase>
      {error && <Alert severity="error">Sign out could not be completed. Please try again.</Alert>}
    </>
  );
  if (desktop)
    return (
      <Box
        sx={{
          width: 264,
          height: '100dvh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: portalSurfaces.chrome,
          borderRight: 1,
          borderColor: portalSurfaces.border,
        }}
      >
        <Box sx={{ px: 2.5, py: 3, borderBottom: 1, borderColor: portalSurfaces.border, mb: 2 }}>
          <PortalBrand />
        </Box>
        <Box component="nav" aria-label="Client navigation" sx={{ px: 1.5, pb: 2 }}>
          {rows(primary)}
          <Divider sx={{ my: 2 }} />
          <ButtonBase
            aria-expanded={expanded}
            aria-controls="portal-more-desktop"
            onClick={() => setExpanded(!expanded)}
            sx={rowStyle}
          >
            <MoreHorizRounded />
            <Typography>More</Typography>
            <ExpandMoreRounded sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </ButtonBase>
          <Box id="portal-more-desktop" hidden={!expanded}>
            {rows(utilities)}
            {accountActions}
          </Box>
        </Box>
        <Box sx={{ p: 2, mt: 'auto' }}>
          <SecureWorkspace />
        </Box>
      </Box>
    );
  return (
    <>
      <Box
        component="nav"
        aria-label="Client navigation"
        sx={{
          position: 'fixed',
          zIndex: 1100,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          bgcolor: portalSurfaces.chrome,
          borderTop: 1,
          borderColor: portalSurfaces.border,
          pb: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 28px rgba(0,0,0,.15)',
        }}
      >
        {direct.map(({ id, path, label, icon }) => {
          const Icon = portalIcons[id] ?? icon;
          return (
            <ButtonBase
              key={id}
              component={Link}
              to={path}
              aria-current={active === id ? 'page' : undefined}
              sx={{
                minHeight: 68,
                flexDirection: 'column',
                gap: 0.6,
                borderTop: '2px solid',
                borderColor: active === id ? 'primary.main' : 'transparent',
                background: active === id ? portalSurfaces.selected : 'transparent',
                color: active === id ? 'primary.main' : 'text.secondary',
                '& svg': {
                  filter: active === id ? 'drop-shadow(0 0 6px rgba(37,207,174,.35))' : 'none',
                },
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
              <Typography
                sx={{ fontSize: 10.5, whiteSpace: 'nowrap', fontWeight: active === id ? 700 : 500 }}
              >
                {label}
              </Typography>
            </ButtonBase>
          );
        })}
        <ButtonBase
          onClick={() => setOpen(true)}
          aria-current={!direct.some((i) => i.id === active) ? 'page' : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'portal-more-sheet' : undefined}
          sx={{
            minHeight: 68,
            flexDirection: 'column',
            gap: 0.6,
            borderTop: '2px solid',
            borderColor: direct.some((i) => i.id === active) ? 'transparent' : 'primary.main',
            background: direct.some((i) => i.id === active)
              ? 'transparent'
              : portalSurfaces.selected,
            color: direct.some((i) => i.id === active) ? 'text.secondary' : 'primary.main',
          }}
        >
          <MoreHorizRounded />
          <Typography sx={{ fontSize: 10.5 }}>More</Typography>
        </ButtonBase>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="portal-more-title"
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            id: 'portal-more-sheet',
            sx: {
              position: 'fixed',
              bottom: 0,
              m: 0,
              width: '100%',
              maxHeight: '88dvh',
              borderRadius: '20px 20px 0 0',
              background: portalSurfaces.overlay,
              pb: 'env(safe-area-inset-bottom)',
            },
          },
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 4,
            borderRadius: 2,
            bgcolor: 'text.secondary',
            opacity: 0.4,
            mx: 'auto',
            mt: 1.25,
          }}
        />
        <DialogTitle
          id="portal-more-heading"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box component="span" id="portal-more-title">
            More
          </Box>
          <IconButton aria-label="Close More" onClick={() => setOpen(false)}>
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box component="nav" aria-label="More destinations">
            {rows(primary.slice(4))}
            <Divider sx={{ my: 1.5 }} />
            {rows(utilities)}
            {accountActions}
          </Box>
          <Box sx={{ mt: 2 }}>
            <SecureWorkspace />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
