import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CreditReviewHistory } from './PublishedCreditCenterPages';
const earlier = {
  id: 'old',
  reviewId: 'old-review',
  publishedAt: '2026-08-01T00:00:00Z',
  recommendation: 'PREPARE_FIRST',
  projection: { analysisSummary: 'Earlier assessment', profile: { experianScore: 610 } },
  report: null,
};
const latest = {
  ...earlier,
  id: 'new',
  reviewId: 'new-review',
  publishedAt: '2026-09-01T00:00:00Z',
  projection: { analysisSummary: 'Later assessment', profile: { experianScore: 720 } },
};
test('latest publication comes from its identity, and expanded facts stay with their own snapshot', async () => {
  render(<CreditReviewHistory history={[earlier, latest]} latestId="new" />);
  expect(screen.queryByText('Earlier assessment')).not.toBeInTheDocument();
  const old = screen.getByRole('button', { name: /Earlier published Credit Review/ });
  fireEvent.click(old);
  expect(await screen.findByText('Earlier assessment')).toBeVisible();
  expect(screen.getByRole('img', { name: /Experian score 610/ })).toBeVisible();
  expect(screen.queryByRole('img', { name: /Experian score 720/ })).not.toBeInTheDocument();
  const next = screen.getByRole('button', { name: /Latest published Credit Review/ });
  fireEvent.click(next);
  expect(await screen.findByText('Later assessment')).toBeVisible();
  expect(screen.getByRole('img', { name: /Experian score 720/ })).toBeVisible();
  expect(within(old).queryByText('Current')).not.toBeInTheDocument();
});
test('empty history has an explicit state', () => {
  render(<CreditReviewHistory history={[]} latestId="missing" />);
  expect(screen.getByText('No publication history is available.')).toBeInTheDocument();
});
