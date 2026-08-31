import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { SectionCard } from './SectionCard';

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <SectionCard>
      <Stack spacing={2} sx={{ py: 3, alignItems: 'center', textAlign: 'center' }}>
        <Box sx={{ color: 'primary.main', fontSize: 34 }}>{icon}</Box>
        <Typography variant="h3">{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 460 }}>
          {description}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
          {primaryAction}
          {secondaryAction}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
export function ErrorAlert({
  title = 'Something needs attention',
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <Alert severity="error">
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      {message}
    </Alert>
  );
}
export function LoadingSkeleton() {
  return (
    <SectionCard className="AppLoadingSkeleton-root">
      <Stack spacing={2}>
        <Skeleton width="28%" />
        <Skeleton height={52} />
        <Skeleton width="72%" />
        <Skeleton variant="rounded" height={90} />
      </Stack>
    </SectionCard>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
