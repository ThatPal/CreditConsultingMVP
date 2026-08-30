import { Box, Divider, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';
import { designTokens } from '../../theme';

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
          '& .MuiTypography-root': { color: 'inherit' },
          '& .MuiTypography-colorTextSecondary': { color: designTokens.color.focusTextMuted },
          '& .MuiDivider-root': { borderColor: designTokens.color.focusBorder },
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
