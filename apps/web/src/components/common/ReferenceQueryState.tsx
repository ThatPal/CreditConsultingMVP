import { Stack } from '@mui/material';
import { PageHeader } from './PageHeader';
import { LoadingSkeleton } from './Feedback';
import { RecoveryState } from './InteractionPatterns';
export function ReferenceQueryState({
  headingComponent = 'h1',
  title,
  loading = false,
  error,
  onRetry,
}: {
  headingComponent?: 'h1' | 'h2';
  title: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <Stack spacing={3}>
      <PageHeader
        headingComponent={headingComponent}
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
