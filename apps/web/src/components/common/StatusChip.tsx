import { Chip } from '@mui/material';

export type StatusTone = 'neutral' | 'info' | 'positive' | 'caution' | 'error' | 'active' | 'muted';
const tones: Record<
  StatusTone,
  {
    color: 'default' | 'info' | 'success' | 'warning' | 'error' | 'primary';
    variant: 'filled' | 'outlined';
  }
> = {
  neutral: { color: 'default', variant: 'outlined' },
  info: { color: 'info', variant: 'outlined' },
  positive: { color: 'success', variant: 'outlined' },
  caution: { color: 'warning', variant: 'outlined' },
  error: { color: 'error', variant: 'outlined' },
  active: { color: 'primary', variant: 'filled' },
  muted: { color: 'default', variant: 'filled' },
};
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return <Chip size="small" label={label} {...tones[tone]} />;
}
