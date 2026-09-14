import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { PlanVersionHistory } from './PlanVersionHistory';
import type { PlanDraft } from './editor';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const workingDraft: PlanDraft = {
  title: 'Unfinished title',
  purpose: 'NURTURE',
  sourceReviewId: null,
  sourceReviewVersion: null,
  sourceGoalRevisionId: null,
  sourceProfileVersion: null,
  items: [],
  paths: [],
  groups: [],
};
const version = (number: number) => ({
  id: `v${number}`,
  version: number,
  status: 'SUPERSEDED',
  optimisticVersion: number,
  title: `Saved title ${number}`,
  purpose: 'NURTURE',
  items: [],
  paths: [],
  createdAt: '2026-09-10T00:00:00Z',
  approvedAt: '2026-09-10T01:00:00Z',
});
test('retains version inspection on pagination failure, retries and compares without writes', async () => {
  let attempts = 0;
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path.includes('?before=')) {
      attempts++;
      if (attempts === 1) throw new Error('offline');
      return { versions: [version(1)], nextBefore: null };
    }
    return {
      versions: [version(2)],
      nextBefore: 2,
      cancellation: { at: '2026-09-14T10:00:00Z', reason: 'Duplicate draft retained for history' },
    };
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlanVersionHistory clientId="client" planId="plan" workingDraft={workingDraft} />
    </QueryClientProvider>,
  );
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Inspect version 2' }));
  expect(screen.getByText(/Duplicate draft retained for history/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Compare with working copy' }));
  expect(screen.getByText('Unfinished title')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Load older versions' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry history' }));
  expect(await screen.findByRole('button', { name: 'Inspect version 1' })).toBeVisible();
  expect(screen.getByText('Inspecting version 2')).toBeVisible();
  expect(workingDraft.title).toBe('Unfinished title');
  expect(vi.mocked(apiRequest).mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
