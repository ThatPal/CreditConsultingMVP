import { Box, type BoxProps } from '@mui/material';

export function StickyTabs({ children, sx, ...props }: BoxProps) {
  return (
    <Box
      {...props}
      sx={[
        {
          position: 'sticky',
          top: 0,
          zIndex: 8,
          bgcolor: 'rgba(7, 11, 24, 0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
