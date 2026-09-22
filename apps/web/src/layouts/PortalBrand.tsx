import { Box, Stack, Typography } from '@mui/material';

/** Shared wordmark treatment from the approved client shell composition. */
export function PortalBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Box
        component="svg"
        viewBox="0 0 48 48"
        aria-hidden="true"
        sx={{
          width: compact ? 32 : 42,
          height: compact ? 32 : 42,
          flexShrink: 0,
          color: 'primary.main',
          filter: 'drop-shadow(0 0 8px rgba(83,165,255,.30))',
        }}
      >
        <path d="M24 3 46 43H2L24 3Zm0 12L11 38h26L24 15Z" fill="currentColor" fillRule="evenodd" />
        <path d="m20 27 17 11H14l6-11Z" fill="currentColor" opacity=".55" />
      </Box>
      <Box>
        <Typography
          sx={{
            fontSize: compact ? 12 : 15,
            letterSpacing: '.05em',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          CREDIT STRATEGY
        </Typography>
        {!compact && (
          <Typography
            sx={{
              fontSize: 6.5,
              mt: 0.5,
              letterSpacing: '.025em',
              whiteSpace: 'nowrap',
              color: 'text.secondary',
            }}
          >
            STRATEGY TODAY. A BRIGHTER TOMORROW.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
