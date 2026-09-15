import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ReviewAnalysisEditor, type AnalysisDraft } from './ReviewAnalysisEditor';
const draft: AnalysisDraft = {
  id: 'draft',
  version: 1,
  analysis: { clientSummary: 'Verified profile summary', evidenceRefs: ['source'] },
  recommendation: {
    outcome: 'PREPARE_FIRST',
    clientExplanation: 'Complete the preparation step.',
    reasons: ['Verified constraint'],
    approved: false,
  },
};
test('uses distinct reasons, preserves analysis context and submits the reviewed revision', async () => {
  const approve = vi.fn(async (input) => ({
    ...draft,
    version: 2,
    analysis: input.analysis,
    recommendation: input.recommendation,
  }));
  render(
    <ReviewAnalysisEditor
      draft={draft}
      unavailable={false}
      pending={false}
      onDirty={() => {}}
      onApprove={approve}
    />,
  );
  fireEvent.change(screen.getByLabelText('Reasons for this recommendation'), {
    target: { value: 'Reason one\nReason two' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Approve analysis and recommendation' }));
  await screen.findByText(/Analysis and recommendation approved/);
  expect(approve).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedVersion: 1,
      analysis: { clientSummary: 'Verified profile summary', evidenceRefs: ['source'] },
      recommendation: expect.objectContaining({ reasons: ['Reason one', 'Reason two'] }),
    }),
  );
});
test('retains wording across revisions until explicit replacement', async () => {
  const approve = vi.fn();
  const props = { unavailable: false, pending: false, onDirty: vi.fn(), onApprove: approve };
  const view = render(<ReviewAnalysisEditor draft={draft} {...props} />);
  fireEvent.change(screen.getByLabelText('Client summary'), {
    target: { value: 'Unfinished wording' },
  });
  view.rerender(
    <ReviewAnalysisEditor
      draft={{ ...draft, version: 2, analysis: { clientSummary: 'Updated source' } }}
      {...props}
    />,
  );
  expect(screen.getByDisplayValue('Unfinished wording')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Approve analysis and recommendation' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Review saved wording' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep my wording' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Review saved wording' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load saved wording' }));
  expect(screen.getByDisplayValue('Updated source')).toBeInTheDocument();
  expect(approve).not.toHaveBeenCalled();
});
test('shows approval failures without dropping the consultant wording', async () => {
  render(
    <ReviewAnalysisEditor
      draft={draft}
      unavailable={false}
      pending={false}
      onDirty={() => {}}
      onApprove={async () => {
        throw new Error('Conflict: refresh required');
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Client summary'), { target: { value: 'Preserve this' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve analysis and recommendation' }));
  await screen.findByText('Conflict: refresh required');
  expect(screen.getByDisplayValue('Preserve this')).toBeVisible();
});
test('enforces reason length and locks approval on unavailable data', () => {
  const props = { pending: false, onDirty: vi.fn(), onApprove: vi.fn() };
  const view = render(<ReviewAnalysisEditor draft={draft} unavailable={false} {...props} />);
  fireEvent.change(screen.getByLabelText('Reasons for this recommendation'), {
    target: { value: 'x'.repeat(501) },
  });
  expect(
    screen.getByRole('button', { name: 'Approve analysis and recommendation' }),
  ).toBeDisabled();
  view.rerender(<ReviewAnalysisEditor draft={draft} unavailable={true} {...props} />);
  expect(
    screen.getByRole('button', { name: 'Approve analysis and recommendation' }),
  ).toBeDisabled();
});
