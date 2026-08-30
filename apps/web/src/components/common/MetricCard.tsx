import { Box, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { designTokens } from '../../theme';
import { SectionCard } from './SectionCard';

export function MetricCard({
  label,
  value,
  supportingText,
  icon,
  accent = 'info',
  loading = false,
}: {
  label: string;
  value: ReactNode;
  supportingText?: string;
  icon?: ReactNode;
  accent?: 'info' | 'positive' | 'gradient';
  loading?: boolean;
}) {
  const accentColor = accent === 'positive' ? designTokens.color.teal : designTokens.color.cyan;
  return (
    <SectionCard
      variant="interactive"
      sx={{
        minHeight: 170,
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 'auto -30px -45px auto',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: accent === 'gradient' ? designTokens.gradient.brand : accentColor,
          opacity: 0.09,
          filter: 'blur(10px)',
        },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="overline" color="text.secondary">
            {label}
          </Typography>
          {icon && <Box sx={{ color: accentColor }}>{icon}</Box>}
        </Stack>
        {loading ? (
          <Skeleton width="66%" height={54} />
        ) : (
          <Typography variant="h2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
        )}
        {supportingText && (
          <Typography variant="body2" color="text.secondary">
            {supportingText}
          </Typography>
        )}
      </Stack>
    </SectionCard>
  );
}
