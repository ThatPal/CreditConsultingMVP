import { useEffect, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import type { EntryGoalValues } from '@credit/shared';
import { apiRequest } from '../auth/api';
import { EntryIntentStrip } from './EntryComponents';
import { entryLink } from './continuation';

export function SavedEntryContext() {
  const [params] = useSearchParams();
  const token = params.get('intake');
  const [saved, setSaved] = useState<(EntryGoalValues & { expiresAt: string }) | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    if (!token) return;
    void apiRequest<{ intake: EntryGoalValues & { expiresAt: string } }>(
      `/api/v1/goal-intakes/${encodeURIComponent(token)}`,
    )
      .then((result) => {
        if (active) setSaved(result.intake);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [token]);
  if (!token) return null;
  return (
    <Stack spacing={1}>
      {saved ? (
        <EntryIntentStrip state="SAVED" summary={saved} expiresAt={saved.expiresAt} />
      ) : unavailable ? (
        <EntryIntentStrip state="UNAVAILABLE" />
      ) : (
        <Alert severity="info">Loading your optional saved goal…</Alert>
      )}
      <Button component={Link} to={entryLink('/goal-intake', params)}>
        Back to saved goal
      </Button>
    </Stack>
  );
}
