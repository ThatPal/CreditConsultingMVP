import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      sx={{ justifyContent: 'space-between', gap: 3, alignItems: { md: 'flex-end' } }}
    >
      <Box>
        {eyebrow && (
          <Typography
            variant="overline"
            color="primary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
              '&::before': {
                content: '""',
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                boxShadow: '0 0 14px #66d8bd88',
              },
            }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h1" sx={{ textWrap: 'balance', maxWidth: 900 }}>
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions}
    </Stack>
  );
}
