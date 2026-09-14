import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ClientPlanItem } from '../../pages/PlanPages';
import { PlanFollowUp } from './PlanFollowUp';
const item: ClientPlanItem = {
  id: 'step',
  type: 'ACTION',
  completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
  status: 'IN_PROGRESS',
  title: 'Report update',
  body: null,
  deepLink: null,
  prerequisites: [],
  owner: 'CLIENT',
  latestOutcomeId: 'correction',
  history: [
    {
      id: 'correction',
      kind: 'CORRECTION_REQUESTED',
      data: { note: 'Include the report date.' },
      createdAt: '2026-09-14T12:00:00Z',
    },
  ],
};
test('makes the latest correction and client next step visible without opening history', () => {
  render(<PlanFollowUp item={item} canAct />);
  expect(screen.getByText('Include the report date.')).toBeVisible();
  expect(screen.getByText(/submit an updated response below/)).toBeVisible();
});
test('shows a help reply without describing the step as completed', () => {
  render(
    <PlanFollowUp
      item={{ ...item, history: [{ ...item.history![0]!, kind: 'HELP_RESOLVED' }] }}
      canAct
    />,
  );
  expect(screen.getByText('Your consultant replied')).toBeVisible();
  expect(screen.getByText(/has not been marked complete/)).toBeVisible();
});
test('keeps feedback visible during a source pause without inviting submission', () => {
  render(<PlanFollowUp item={item} canAct={false} />);
  expect(screen.getByText('Include the report date.')).toBeVisible();
  expect(screen.getByText(/when the step reopens/)).toBeVisible();
  expect(screen.queryByText(/submit an updated response/)).not.toBeInTheDocument();
});
test.each(['AWAITING_VERIFICATION', 'COMPLETED', 'LOCKED'])(
  'does not revive an old correction for %s work',
  (status) => {
    const { container } = render(<PlanFollowUp item={{ ...item, status }} canAct />);
    expect(container).toBeEmptyDOMElement();
  },
);
test('requires matching latest evidence and clears the prompt after resubmission', () => {
  const { container, rerender } = render(
    <PlanFollowUp item={{ ...item, latestOutcomeId: 'new-response' }} canAct />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(
    <PlanFollowUp
      item={{
        ...item,
        latestOutcomeId: 'new-response',
        history: [
          ...item.history!,
          { id: 'new-response', kind: 'COMPLETE', data: {}, createdAt: '2026-09-14T13:00:00Z' },
        ],
      }}
      canAct
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
