import { Stack } from '@mui/material';
import { PageHeader } from './PageHeader';
import { LoadingSkeleton } from './Feedback';
import { RecoveryState } from './InteractionPatterns';
export function ReferenceQueryState({
  title,
  loading = false,
  error,
  onRetry,
}: {
  title: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Your workspace"
        title={title}
        description={
          loading
            ? 'Loading your latest information.'
            : 'Your information could not be confirmed. Your saved work has not changed.'
        }
      />
      {loading ? (
        <LoadingSkeleton label={'Loading ' + title} />
      ) : (
        <RecoveryState error={error} {...(onRetry ? { onRetry } : {})} />
      )}
    </Stack>
  );
}
