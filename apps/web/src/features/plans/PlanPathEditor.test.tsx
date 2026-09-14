import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PlanPathEditor } from './PlanPathEditor';
import { editorIssues, type PlanDraft } from './editor';
const draft: PlanDraft = {
  title: 'Plan',
  purpose: 'NURTURE',
  sourceReviewId: null,
  sourceReviewVersion: null,
  sourceGoalRevisionId: null,
  sourceProfileVersion: null,
  items: [],
  paths: [],
  groups: [],
};
test('creates an inactive path and allows removal only before steps reference it', () => {
  function Editor() {
    const [value, setValue] = useState(draft);
    return <PlanPathEditor draft={value} onChange={setValue} disabled={false} />;
  }
  render(<Editor />);
  fireEvent.click(screen.getByText('Plan paths · 0'));
  fireEvent.click(screen.getByRole('button', { name: 'Add path' }));
  expect(screen.getByRole('textbox', { name: 'Path label' })).toHaveValue('New path');
  expect(screen.getByRole('combobox', { name: 'Path status' })).toHaveTextContent('Inactive');
  fireEvent.click(screen.getByRole('button', { name: 'Remove unused path' }));
  expect(screen.queryByRole('textbox', { name: 'Path label' })).not.toBeInTheDocument();
});
test('flags unreachable required steps and hidden recorded progress', () => {
  const value: PlanDraft = {
    ...draft,
    paths: [
      { key: 'a', clientLabel: 'Path', internalLabel: null, status: 'INACTIVE', sortOrder: 0 },
    ],
    items: [
      {
        stableKey: 'one',
        type: 'ACTION',
        owner: 'CLIENT',
        completionMode: 'ACKNOWLEDGEMENT',
        clientTitle: 'Recorded step',
        clientBody: null,
        consultantRationale: null,
        sortOrder: 0,
        required: true,
        pathKeys: ['a'],
        status: 'COMPLETED',
      },
    ],
  };
  expect(editorIssues(value).some((issue) => issue.includes('active path'))).toBe(true);
  expect(editorIssues(value).some((issue) => issue.includes('recorded progress'))).toBe(true);
});
