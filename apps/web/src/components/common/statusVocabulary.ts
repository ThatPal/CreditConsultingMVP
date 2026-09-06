import type { StatusTone } from './StatusChip';
type Presentation = { label: string; tone: StatusTone; explanation?: string; nextAction?: string };
const vocabulary: Record<string, Presentation> = {
  AVAILABLE: { label: 'Ready', tone: 'positive' },
  LOCKED: {
    label: 'Not yet available',
    tone: 'muted',
    explanation: 'Complete the prerequisite step first.',
  },
  ACTIVE: { label: 'Active', tone: 'active' },
  PENDING: { label: 'Pending', tone: 'caution' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  SUCCEEDED: { label: 'Completed', tone: 'positive' },
  COMPLETED: { label: 'Completed', tone: 'positive' },
  FAILED: { label: 'Needs attention', tone: 'error' },
  OPEN: { label: 'Open', tone: 'active' },
  RESOLVED: { label: 'Resolved', tone: 'positive' },
  CLOSED: { label: 'Closed', tone: 'muted' },
  WAITING_ON_CLIENT: { label: 'Waiting for you', tone: 'caution' },
  WAITING_ON_SUPPORT: { label: 'With support', tone: 'info' },
  OTHER: { label: 'Other', tone: 'neutral' },
  STALE: { label: 'Update available', tone: 'caution', nextAction: 'Refresh before continuing.' },
};
export function presentStatus(value: string | null | undefined): Presentation {
  if (!value) return { label: 'Not available', tone: 'muted' };
  return (
    vocabulary[value] ?? {
      label: value
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  );
}
