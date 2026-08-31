import { Box, type SxProps, type Theme } from '@mui/material';
import type { PropsWithChildren } from 'react';
import { designTokens } from '../../theme';

export type SectionCardVariant = 'standard' | 'elevated' | 'interactive' | 'operational';

export function SectionCard({
  children,
  variant = 'standard',
  sx,
  className,
}: PropsWithChildren<{
  variant?: SectionCardVariant;
  sx?: SxProps<Theme>;
  className?: string;
}>) {
  const styles: Record<SectionCardVariant, SxProps<Theme>> = {
    standard: { bgcolor: designTokens.color.surface, borderColor: designTokens.color.border },
    elevated: {
      bgcolor: designTokens.color.surfaceElevated,
      backgroundImage: designTokens.gradient.subtle,
      borderColor: designTokens.color.borderStrong,
      boxShadow: designTokens.shadow.elevated,
    },
    interactive: {
      bgcolor: designTokens.color.surface,
      borderColor: designTokens.color.border,
      cursor: 'pointer',
      '&:hover': {
        transform: 'translateY(-3px)',
        borderColor: designTokens.color.borderStrong,
        boxShadow: designTokens.shadow.glow,
      },
    },
    operational: {
      bgcolor: designTokens.color.surfaceOperational,
      borderColor: designTokens.color.border,
      borderRadius: `${designTokens.radius.sm}px`,
    },
  };
  return (
    <Box
      className={className}
      sx={[
        {
          border: '1px solid',
          borderRadius: `${designTokens.radius.lg}px`,
          p: { xs: 2.25, sm: 3 },
          boxShadow: designTokens.shadow.card,
          transition: `transform ${designTokens.motion.standard} ${designTokens.motion.easing}, border-color ${designTokens.motion.standard} ${designTokens.motion.easing}, box-shadow ${designTokens.motion.standard} ${designTokens.motion.easing}`,
        },
        styles[variant],
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
