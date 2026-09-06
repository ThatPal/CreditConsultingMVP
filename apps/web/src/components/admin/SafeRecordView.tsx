import { Box, Chip, Stack, Typography } from '@mui/material';

const blockedKey =
  /(authorization|cookie|password|secret|token|credential|card(number)?|cvv|private.?key)/i;

export const humanizeAdminLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat().format(value);
  if (Array.isArray(value)) return value.map(displayValue).join(', ') || 'None';
  if (typeof value === 'object') return 'Structured record available';
  const text = String(value);
  return /^[A-Z][A-Z0-9_]+$/.test(text) ? humanizeAdminLabel(text.toLowerCase()) : text;
};

export function SafeRecordView({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record).filter(([key]) => !blockedKey.test(key));
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, .45fr) 1fr' },
        gap: 1,
      }}
    >
      {entries.map(([key, value]) => (
        <Stack
          key={key}
          component="div"
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ display: 'contents' }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {humanizeAdminLabel(key)}
          </Typography>
          <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {displayValue(value)}
          </Typography>
        </Stack>
      ))}
      {!entries.length && (
        <Chip label="No safe metadata recorded" size="small" sx={{ width: 'fit-content' }} />
      )}
    </Box>
  );
}
