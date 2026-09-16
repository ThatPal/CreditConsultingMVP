import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { designTokens } from '../../theme';

/** A reference position, not a model-specific rating or eligibility assessment. */
export function PublishedScoreGauge({ value, bureau }: { value: number | null; bureau: string }) {
  const gradient = useId().replaceAll(':', '');
  const inRange = value !== null && Number.isFinite(value) && value >= 300 && value <= 850;
  const angle = inRange ? Math.PI * (1 - (value - 300) / 550) : 0;
  const x = 110 + 84 * Math.cos(angle),
    y = 110 - 84 * Math.sin(angle);
  return (
    <Box
      sx={{
        minWidth: 0,
        textAlign: 'center',
        display: { xs: 'grid', sm: 'block' },
        gridTemplateColumns: '90px minmax(0, 1fr)',
        alignItems: 'center',
        columnGap: 2,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {bureau}
      </Typography>
      <Box
        role="img"
        aria-label={
          value === null
            ? `${bureau}: not reported`
            : `${bureau} score ${value}${inRange ? ', shown on a common 300 to 850 reference scale; scoring model not supplied' : ', outside the reference scale'}`
        }
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: { xs: 180, sm: 240 },
          mx: 'auto',
          mt: 1,
        }}
      >
        <svg
          viewBox="0 0 220 140"
          width="100%"
          aria-hidden="true"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradient}>
              <stop offset="0%" stopColor={designTokens.color.coral} />
              <stop offset="45%" stopColor={designTokens.color.amber} />
              <stop offset="75%" stopColor={designTokens.accent.main} />
              <stop offset="100%" stopColor={designTokens.color.cyan} />
            </linearGradient>
          </defs>
          <path
            d="M26 110 A84 84 0 0 1 194 110"
            fill="none"
            stroke={inRange ? `url(#${gradient})` : designTokens.color.border}
            strokeWidth="12"
            strokeLinecap="round"
          />
          {inRange && (
            <>
              <circle
                cx={x}
                cy={y}
                r="11"
                fill={designTokens.color.surface}
                stroke={designTokens.color.textPrimary}
                strokeWidth="3"
              />
              <circle cx={x} cy={y} r="4" fill={designTokens.accent.main} />
            </>
          )}
          <text
            x="110"
            y="101"
            textAnchor="middle"
            fill={designTokens.color.textPrimary}
            fontSize={value === null ? 16 : 38}
            fontWeight="700"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value ?? 'Not reported'}
          </text>
          <text
            x="26"
            y="136"
            textAnchor="middle"
            fill={designTokens.color.textSecondary}
            fontSize="11"
          >
            300
          </text>
          <text
            x="194"
            y="136"
            textAnchor="middle"
            fill={designTokens.color.textSecondary}
            fontSize="11"
          >
            850
          </text>
        </svg>
      </Box>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          maxWidth: 200,
          mx: 'auto',
          width: '100%',
          gridColumn: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Lower
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Higher
        </Typography>
      </Stack>
      {value !== null && !inRange && (
        <Typography variant="caption">Outside reference range</Typography>
      )}
    </Box>
  );
}

export function PublishedUtilizationRing({ value }: { value: number | null }) {
  const valid = value !== null && Number.isFinite(value) && value >= 0;
  const fill = valid ? Math.min(value, 100) : 0;
  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 2 }}>
      <Box
        role="img"
        aria-label={
          valid
            ? `Credit utilization ${value} percent${value > 100 ? '; ring capped at 100 percent' : ''}`
            : 'Credit utilization not reported'
        }
        sx={{
          position: 'relative',
          flexShrink: 0,
          width: 136,
          height: 136,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: `conic-gradient(from -90deg, ${designTokens.accent.main} 0%, ${designTokens.color.cyan} ${fill}%, ${designTokens.color.border} ${fill}% 100%)`,
          boxShadow: designTokens.shadow.glow,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 10,
            borderRadius: '50%',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ position: 'relative', textAlign: 'center' }}>
          <Typography
            sx={{ fontSize: valid ? 28 : 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {valid ? `${value.toLocaleString()}%` : 'Not reported'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            in use
          </Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 120 }}>
        <Typography variant="h4">Revolving credit</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The share of your reported revolving limit currently in use.
        </Typography>
        {valid && value > 100 && (
          <Typography variant="caption">Reported balance exceeds the limit.</Typography>
        )}
      </Box>
    </Stack>
  );
}
