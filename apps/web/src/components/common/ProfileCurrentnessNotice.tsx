import { Box, Stack, Typography } from '@mui/material';
import UpdateRounded from '@mui/icons-material/UpdateRounded';

export type ProfileCurrentnessRead = {
  status: string;
  isCurrent?: boolean;
  reason?: string;
  effectiveAt?: string | null;
  expiresAt?: string | null;
};
const messages: Record<string, { title: string; detail: string }> = {
  EXPIRED: {
    title: 'Your published assessment has expired',
    detail:
      'The saved credit facts remain available. Your consultant needs to reassess them before treating this publication as current.',
  },
  BASIS_UNCONFIRMED: {
    title: 'Your published assessment needs confirmation',
    detail:
      'The saved publication is not confirmed against your current Profile. Your consultant needs to confirm its source before relying on it for new recommendations.',
  },
  REASSESSMENT_REQUIRED: {
    title: 'Your Credit Profile needs reassessment',
    detail:
      'Your saved credit facts remain available, but the published assessment is no longer current. Your consultant needs to review the changes.',
  },
};
/** Displays server currentness only; never grants, blocks or reconstructs command authority. */
export function ProfileCurrentnessNotice({
  profile,
}: {
  profile: ProfileCurrentnessRead | null | undefined;
}) {
  if (
    !profile ||
    profile.isCurrent === true ||
    profile.reason === 'NO_PUBLICATION' ||
    ['NOT_AVAILABLE', 'REVIEW_IN_PROGRESS'].includes(profile.status)
  )
    return null;
  if (profile.isCurrent !== false && profile.status !== 'STALE') return null;
  const message = messages[profile.reason ?? ''] ?? {
    title: 'Your Profile currentness needs review',
    detail:
      'This publication remains available as a saved record. Its current status needs to be confirmed before it is used for new recommendations.',
  };
  const published =
    profile.effectiveAt && Number.isFinite(Date.parse(profile.effectiveAt))
      ? new Date(profile.effectiveAt).toLocaleDateString()
      : null;
  return (
    <Stack
      component="section"
      aria-label="Credit Profile currentness"
      direction="row"
      spacing={2}
      sx={{
        p: 2.5,
        border: 1,
        borderColor: 'rgba(246,184,75,.32)',
        borderRadius: '16px',
        background: 'linear-gradient(110deg, rgba(246,184,75,.10), rgba(246,184,75,.025))',
      }}
    >
      <UpdateRounded aria-hidden="true" sx={{ color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
      <Box>
        <Typography sx={{ fontWeight: 700 }}>{message.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 900 }}>
          {message.detail}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {published ? `Published ${published} · ` : ''}Follow the current next step shown in your
          workspace. Each Plan step shows whether a response is available.
        </Typography>
      </Box>
    </Stack>
  );
}
