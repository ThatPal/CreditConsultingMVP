import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigationProtection } from '../NavigationProtection';
export const reviewOutcomes: Record<string, string> = {
  PROCEED: 'Proceed',
  PROCEED_SELECTIVELY: 'Proceed selectively',
  PREPARE_FIRST: 'Prepare first',
  WAIT_NURTURE: 'Wait and strengthen the profile',
  MAJOR_APPLICATION_PRIORITY: 'Prioritize the major application',
};
export type AnalysisDraft = {
  id: string;
  version: number;
  analysis: ({ clientSummary?: string } & Record<string, unknown>) | null;
  recommendation: {
    outcome: string;
    clientExplanation: string;
    reasons: string[];
    approved: boolean;
  } | null;
};
export type AnalysisApproval = {
  expectedVersion: number;
  analysis: Record<string, unknown>;
  recommendation: NonNullable<AnalysisDraft['recommendation']>;
  approveAnalysis: true;
  approveRecommendation: true;
};
const values = (draft: AnalysisDraft) => ({
  summary: draft.analysis?.clientSummary ?? '',
  outcome: draft.recommendation?.outcome ?? 'PREPARE_FIRST',
  explanation: draft.recommendation?.clientExplanation ?? '',
  reasons: draft.recommendation?.reasons.join('\n') ?? '',
});
export function ReviewReadingPreview({
  summary,
  outcome,
  explanation,
  reasons,
}: {
  summary: string;
  outcome: string;
  explanation: string;
  reasons: string[];
}) {
  return (
    <Box
      sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 2, py: 1, overflowWrap: 'anywhere' }}
    >
      <Typography variant="overline">Client reading preview</Typography>
      <Typography variant="h5">
        {reviewOutcomes[outcome] ?? 'Recommendation not selected'}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
        {summary || 'Add a summary of the client’s profile.'}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', mt: 2 }}>
        {explanation || 'Explain the recommendation and next step.'}
      </Typography>
      {reasons.length > 0 && (
        <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>
          {reasons.map((reason, index) => (
            <Typography component="li" key={index}>
              {reason}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
export function ReviewAnalysisEditor({
  draft,
  unavailable,
  pending,
  onApprove,
  onDirty,
}: {
  draft: AnalysisDraft;
  unavailable: boolean;
  pending: boolean;
  onApprove: (input: AnalysisApproval) => Promise<AnalysisDraft>;
  onDirty: (dirty: boolean) => void;
}) {
  const [reviewed, setReviewed] = useState(draft);
  const [form, setForm] = useState(() => values(draft));
  const [reload, setReload] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(values(reviewed));
  const changed = reviewed.id !== draft.id || reviewed.version !== draft.version;
  const reasons = form.reasons
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const invalid =
    !form.summary.trim() ||
    !form.explanation.trim() ||
    form.explanation.length > 4000 ||
    !reviewOutcomes[form.outcome] ||
    reasons.length === 0 ||
    reasons.length > 20 ||
    reasons.some((x) => x.length > 500);
  useNavigationProtection(dirty, pending);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);
  const submit = async () => {
    setError('');
    setNotice('');
    try {
      const saved = await onApprove({
        expectedVersion: reviewed.version,
        analysis: { ...reviewed.analysis, clientSummary: form.summary.trim() },
        recommendation: {
          outcome: form.outcome,
          clientExplanation: form.explanation.trim(),
          reasons,
          approved: true,
        },
        approveAnalysis: true,
        approveRecommendation: true,
      });
      setReviewed(saved);
      setForm(values(saved));
      setNotice(
        'Analysis and recommendation approved. Review the saved wording before publishing.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Approval could not be confirmed. Your wording is still here.',
      );
    }
  };
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h3">Analysis and recommendation</Typography>
        <Typography color="text.secondary">
          Explain what the verified facts mean for this client, why you recommend this path, and who
          owns the next step.
        </Typography>
      </Box>
      {dirty && (
        <Alert severity="info">
          You have unapproved wording changes. Approve them before publishing.
        </Alert>
      )}
      {changed && (
        <Alert severity="warning">
          The saved Review draft changed. Your wording is still here. Load the current draft before
          approving.
        </Alert>
      )}
      {(changed || dirty) && (
        <Button disabled={pending || unavailable} onClick={() => setReload(true)}>
          Review saved wording
        </Button>
      )}
      {unavailable && (
        <Alert severity="warning">
          Current Review data is unavailable. Your wording is retained; approval is paused.
        </Alert>
      )}
      <TextField
        disabled={pending}
        label="Client summary"
        helperText="Summarize meaningful changes, strengths, constraints and uncertainty supported by the verified facts."
        multiline
        minRows={4}
        value={form.summary}
        onChange={(e) => setForm({ ...form, summary: e.target.value })}
      />
      <TextField
        disabled={pending}
        select
        label="Recommended next step"
        value={form.outcome}
        onChange={(e) => setForm({ ...form, outcome: e.target.value })}
      >
        {Object.entries(reviewOutcomes).map(([id, label]) => (
          <MenuItem key={id} value={id}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        disabled={pending}
        label="Explanation for the client"
        helperText="Explain what to do next and whether the client or consultant acts. Up to 4,000 characters."
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 4000 } }}
        value={form.explanation}
        onChange={(e) => setForm({ ...form, explanation: e.target.value })}
      />
      <TextField
        disabled={pending}
        label="Reasons for this recommendation"
        helperText="One evidence-based reason per line. Up to 20 reasons, 500 characters each."
        multiline
        minRows={3}
        error={reasons.length > 20 || reasons.some((x) => x.length > 500)}
        value={form.reasons}
        onChange={(e) => setForm({ ...form, reasons: e.target.value })}
      />
      <ReviewReadingPreview
        summary={form.summary}
        outcome={form.outcome}
        explanation={form.explanation}
        reasons={reasons}
      />
      <Button
        variant="contained"
        disabled={pending || unavailable || changed || invalid}
        onClick={() => void submit()}
      >
        {pending ? 'Approving…' : 'Approve analysis and recommendation'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Dialog
        open={reload}
        onClose={() => setReload(false)}
        aria-labelledby="review-wording-reload"
      >
        <DialogTitle id="review-wording-reload">Load saved wording?</DialogTitle>
        <DialogContent>
          Your unfinished wording will be replaced. Copy any text you want to keep before loading
          the saved draft.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReload(false)}>Keep my wording</Button>
          <Button
            disabled={pending || unavailable}
            onClick={() => {
              setReviewed(draft);
              setForm(values(draft));
              setReload(false);
              setError('');
              setNotice('');
            }}
          >
            Load saved wording
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
