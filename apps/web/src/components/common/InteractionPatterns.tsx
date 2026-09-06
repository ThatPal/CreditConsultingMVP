import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ApiRequestError } from '../../auth/api';

export type Crumb = { label: string; to?: string };
export function RecordContext({
  breadcrumbs,
  title,
  meta,
  actions,
  children,
}: {
  breadcrumbs: Crumb[];
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Stack spacing={1.5} component="header">
      <Breadcrumbs aria-label="Record context">
        {breadcrumbs.map((crumb, index) =>
          crumb.to ? (
            <MuiLink key={crumb.label} component={Link} to={crumb.to} underline="hover">
              {crumb.label}
            </MuiLink>
          ) : (
            <Typography
              key={crumb.label}
              color={index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
            >
              {crumb.label}
            </Typography>
          ),
        )}
      </Breadcrumbs>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h1">{title}</Typography>
          {meta}
        </Box>
        {actions}
      </Stack>
      {children}
    </Stack>
  );
}

const recovery = (error: unknown) => {
  if (!(error instanceof ApiRequestError))
    return {
      severity: 'error' as const,
      title: 'Something went wrong',
      message: 'The request could not be completed. Try again.',
    };
  if (error.status === 401)
    return {
      severity: 'warning' as const,
      title: 'Your session expired',
      message: 'Sign in again to safely continue.',
    };
  if (error.status === 403)
    return {
      severity: 'warning' as const,
      title: 'Access is restricted',
      message: error.message || 'You do not have permission to open this information.',
    };
  if (error.status === 404)
    return {
      severity: 'info' as const,
      title: 'This record is unavailable',
      message: 'It may have moved, been removed, or no longer be in your scope.',
    };
  if (error.status === 409)
    return {
      severity: 'warning' as const,
      title: 'This information changed',
      message: 'Refresh before trying the action again.',
    };
  if (error.status === 400 || error.status === 422)
    return {
      severity: 'warning' as const,
      title: 'Check the information provided',
      message: error.message,
    };
  if (error.status === 503)
    return {
      severity: 'warning' as const,
      title: 'Service temporarily unavailable',
      message: 'Your data is safe. Try again shortly.',
    };
  return { severity: 'error' as const, title: 'Unexpected error', message: error.message };
};
export function RecoveryState({
  error,
  onRetry,
  backTo,
  backLabel = 'Go back',
}: {
  error: unknown;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
}) {
  const copy = recovery(error);
  return (
    <Alert severity={copy.severity}>
      <Typography sx={{ fontWeight: 850 }}>{copy.title}</Typography>
      <Typography>{copy.message}</Typography>
      <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
        {onRetry && (
          <Button size="small" onClick={onRetry}>
            Retry
          </Button>
        )}
        {backTo && (
          <Button size="small" component={Link} to={backTo}>
            {backLabel}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

export function GovernedActionDialog({
  open,
  title,
  effect,
  context,
  reasonLabel,
  reason,
  required = false,
  warning,
  pending = false,
  error,
  onReasonChange,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm action',
}: {
  open: boolean;
  title: string;
  effect: string;
  context?: string;
  reasonLabel?: string;
  reason?: string;
  required?: boolean;
  warning?: boolean;
  pending?: boolean;
  error?: string;
  onReasonChange?: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onCancel}
      aria-labelledby="governed-action-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="governed-action-title">{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>{effect}</Typography>
          {context && <Alert severity="info">Affected record: {context}</Alert>}
          {warning && (
            <Alert severity="warning">
              This action is recorded in the audit history and may require recent MFA verification.
            </Alert>
          )}
          {reasonLabel && (
            <TextField
              autoFocus
              label={reasonLabel}
              value={reason ?? ''}
              required={required}
              multiline
              minRows={2}
              onChange={(e) => onReasonChange?.(e.target.value)}
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={warning ? 'warning' : 'primary'}
          onClick={onConfirm}
          disabled={pending || (required && !reason?.trim())}
        >
          {pending ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
