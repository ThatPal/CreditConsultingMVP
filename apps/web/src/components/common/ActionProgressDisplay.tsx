import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { designTokens } from '../../theme';

/** Renders the server's percentage; never infers progress from submissions or local items. */
export function ActionProgressDisplay({
  percent,
  compact = false,
}: {
  percent: number | null | undefined;
  compact?: boolean;
}) {
  const gradient = useId().replaceAll(':', '');
  if (percent == null || !Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
      <Box
        role="img"
        aria-label={`Action progress: ${Math.round(percent)} percent complete`}
        sx={{
          position: 'relative',
          width: compact ? 104 : { xs: 112, sm: 160 },
          aspectRatio: '1',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg
          viewBox="0 0 160 160"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor={designTokens.accent.main} />
              <stop offset="1" stopColor={designTokens.color.cyan} />
            </linearGradient>
          </defs>
          <circle
            cx="80"
            cy="80"
            r="68"
            fill="none"
            stroke={designTokens.color.border}
            strokeWidth="9"
          />
          {percent > 0 && (
            <circle
              cx="80"
              cy="80"
              r="68"
              pathLength="100"
              fill="none"
              stroke={`url(#${gradient})`}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${percent} 100`}
              transform="rotate(-90 80 80)"
            />
          )}
          <circle
            cx="80"
            cy="80"
            r="54"
            fill="none"
            stroke={designTokens.color.border}
            strokeWidth="1"
            strokeDasharray="1 8"
          />
        </svg>
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: compact ? 25 : { xs: 28, sm: 38 },
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {Math.round(percent)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            complete
          </Typography>
        </Box>
      </Box>
      {!compact && (
        <Typography variant="caption" color="text.secondary">
          Action progress
        </Typography>
      )}
    </Stack>
  );
}
