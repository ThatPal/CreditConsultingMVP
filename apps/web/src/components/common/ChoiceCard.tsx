import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { designTokens } from '../../theme';

export function ChoiceCard({
  title,
  description,
  icon,
  selected = false,
  onClick,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  onClick?: (() => void) | undefined;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        width: '100%',
        textAlign: 'left',
        justifyContent: 'stretch',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : designTokens.color.border,
        bgcolor: selected ? 'rgba(66,211,242,.1)' : designTokens.color.surfaceOperational,
        borderRadius: 2,
        p: 2,
        transition: '160ms ease',
        '&:hover': { borderColor: designTokens.color.borderStrong, transform: 'translateY(-1px)' },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ width: '100%', alignItems: 'flex-start' }}>
        {icon && (
          <Box sx={{ color: selected ? 'primary.main' : 'text.secondary', mt: 0.25 }}>{icon}</Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {description}
            </Typography>
          )}
        </Box>
        {selected && <CheckCircleRounded color="primary" fontSize="small" />}
      </Stack>
    </ButtonBase>
  );
}
