import { Box, Divider, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';
import { designTokens } from '../../theme';

export const focusSurfaceContentStyles = {
  '& .MuiTypography-root': { color: 'inherit' },
  '& .MuiTypography-colorTextSecondary, & .MuiFormHelperText-root': {
    color: designTokens.color.focusTextMuted,
  },
  '& .MuiFormHelperText-root.Mui-error, & .MuiInputLabel-root.Mui-error': {
    color: designTokens.color.focusError,
  },
  '& .MuiInputLabel-root': { color: designTokens.color.focusTextMuted },
  '& .MuiInputBase-root': { color: designTokens.color.focusText },
  '& .MuiInputBase-input::placeholder': {
    color: designTokens.color.focusTextMuted,
    opacity: 1,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: designTokens.color.focusControlBorder,
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: designTokens.color.focusAccent,
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: designTokens.color.focusAccent,
  },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': {
    borderColor: designTokens.color.focusError,
  },
  '& .MuiSvgIcon-root': { color: 'currentColor' },
  '& .MuiInputAdornment-root, & .MuiSelect-icon': { color: designTokens.color.focusTextMuted },
  '& .MuiCheckbox-root, & .MuiRadio-root, & .MuiSwitch-root': {
    color: designTokens.color.focusTextMuted,
  },
  '& .MuiCheckbox-root.Mui-checked, & .MuiRadio-root.Mui-checked, & .MuiSwitch-switchBase.Mui-checked':
    {
      color: designTokens.color.focusAccent,
    },
  '& .MuiFormControlLabel-label': { color: designTokens.color.focusText },
  '& .MuiLink-root': { color: designTokens.color.focusLink },
  '& .MuiDivider-root': { borderColor: designTokens.color.focusBorder },
  '& .MuiTableCell-root': {
    color: designTokens.color.focusText,
    borderColor: designTokens.color.focusBorder,
  },
  '& .MuiTableCell-head': {
    color: designTokens.color.focusText,
    fontWeight: designTokens.typography.weight.strong,
  },
  '& .MuiTableCell-root .MuiTypography-colorTextSecondary': {
    color: designTokens.color.focusTextMuted,
  },
  '& .MuiTableSortLabel-root, & .MuiTableSortLabel-icon': {
    color: designTokens.color.focusTextMuted,
  },
  '& .MuiTableSortLabel-root:hover, & .MuiTableSortLabel-root.Mui-active': {
    color: designTokens.color.focusAccent,
  },
  '& .MuiCircularProgress-root': {
    color: designTokens.color.focusAccent,
    position: 'relative',
    '&::before': {
      border: `3px solid ${designTokens.color.focusLoaderTrack}`,
      borderRadius: '50%',
      boxSizing: 'border-box',
      content: '""',
      inset: 0,
      position: 'absolute',
    },
  },
  '& .MuiLinearProgress-root': {
    backgroundColor: designTokens.color.focusLoaderTrack,
  },
  '& .MuiLinearProgress-bar': { backgroundColor: designTokens.color.focusAccent },
  '& .MuiSkeleton-root': { backgroundColor: designTokens.color.focusSkeleton },
  '& .AppLoadingSkeleton-root': {
    backgroundColor: designTokens.color.focusLoaderContainer,
    backgroundImage: 'none',
    borderColor: designTokens.color.focusBorder,
    boxShadow: 'none',
  },
} as const;

export function FocusSurface({
  title,
  eyebrow,
  action,
  variant = 'neutral',
  children,
  sx,
}: PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  variant?: 'neutral' | 'positive';
  sx?: SxProps<Theme>;
}>) {
  return (
    <Box
      sx={[
        {
          bgcolor:
            variant === 'positive'
              ? designTokens.color.focusSurfacePositive
              : designTokens.color.focusSurface,
          color: designTokens.color.focusText,
          border: `1px solid ${designTokens.color.focusBorder}`,
          borderRadius: `${designTokens.radius.lg}px`,
          p: { xs: 2.5, sm: 4 },
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.18)',
          ...focusSurfaceContentStyles,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {(title || eyebrow || action) && (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
          >
            <Box>
              {eyebrow && (
                <Typography
                  variant="overline"
                  sx={{ color: `${designTokens.color.focusAccent} !important` }}
                >
                  {eyebrow}
                </Typography>
              )}
              {title && <Typography variant="h3">{title}</Typography>}
            </Box>
            {action}
          </Stack>
          <Divider sx={{ my: 2.5 }} />
        </>
      )}
      {children}
    </Box>
  );
}
