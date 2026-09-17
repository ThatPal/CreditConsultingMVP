import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
import { useAuth } from '../auth/AuthProvider';
import { activeNavigationId, type NavigationItem } from './navigation';
import { portalSurfaces } from '../theme/portalSurfaces';

export function SecureWorkspace() {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        p: 2,
        border: 1,
        borderColor: portalSurfaces.border,
        borderRadius: 2,
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
    entries.map(({ id, path, label, icon: Icon }) => (
      <ButtonBase
        key={id}
        component={Link}
        to={path}
        onClick={() => setOpen(false)}
        aria-current={active === id ? 'page' : undefined}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          gap: 1.75,
          px: 2,
          py: 1.35,
          mb: 0.4,
          borderRadius: 1,
          textAlign: 'left',
          borderLeft: '2px solid',
          borderColor: active === id ? 'primary.main' : 'transparent',
          color: active === id ? 'text.primary' : 'text.secondary',
          background: active === id ? portalSurfaces.selected : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Icon sx={{ fontSize: 21, color: active === id ? 'primary.main' : 'inherit' }} />
        <Typography variant="body2" sx={{ fontWeight: active === id ? 700 : 500 }}>
          {label}
        </Typography>
      </ButtonBase>
    ));
  const accountActions = (
    <>
      <Button
        fullWidth
        component={Link}
        to="/app/account/security"
        startIcon={<SettingsOutlined />}
        onClick={() => setOpen(false)}
        sx={{ justifyContent: 'flex-start', px: 2, color: 'text.secondary' }}
      >
        Settings
      </Button>
      <Button
        fullWidth
        startIcon={<LogoutRounded />}
        onClick={async () => {
          try {
            await logout();
            navigate('/login', { replace: true });
          } catch {
            setError(true);
          }
        }}
        sx={{ justifyContent: 'flex-start', px: 2, color: 'text.secondary' }}
      >
        Sign Out
      </Button>
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
        <Stack direction="row" spacing={1.5} sx={{ p: 3, alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{ color: 'primary.main', fontSize: 34, fontWeight: 800, lineHeight: 1 }}
          >
            C<span style={{ color: 'white', fontSize: 18 }}>.</span>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 750, fontSize: 16 }}>Credit Strategy</Typography>
            <Typography variant="caption" color="text.secondary">
              Your private advisory workspace
            </Typography>
          </Box>
        </Stack>
        <Box component="nav" aria-label="Client navigation" sx={{ px: 1.5, pb: 2 }}>
          {rows(primary)}
          <Divider sx={{ my: 2 }} />
          <Button
            fullWidth
            aria-expanded={expanded}
            aria-controls="portal-more-desktop"
            onClick={() => setExpanded(!expanded)}
            startIcon={<MoreHorizRounded />}
            endIcon={
              <ExpandMoreRounded
                sx={{ ml: 'auto', transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
            }
            sx={{ justifyContent: 'flex-start', color: 'text.secondary', px: 2 }}
          >
            More
          </Button>
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
        {direct.map(({ id, path, label, icon: Icon }) => (
          <ButtonBase
            key={id}
            component={Link}
            to={path}
            aria-current={active === id ? 'page' : undefined}
            sx={{
              minHeight: 68,
              flexDirection: 'column',
              gap: 0.6,
              color: active === id ? 'primary.main' : 'text.secondary',
              borderTop: '2px solid',
              borderColor: active === id ? 'primary.main' : 'transparent',
              background: active === id ? portalSurfaces.selected : 'transparent',
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
            <Typography
              sx={{ fontSize: 10.5, whiteSpace: 'nowrap', fontWeight: active === id ? 700 : 500 }}
            >
              {label}
            </Typography>
          </ButtonBase>
        ))}
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
              bgcolor: portalSurfaces.chrome,
              pb: 'env(safe-area-inset-bottom)',
            },
          },
        }}
      >
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
