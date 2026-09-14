import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
  PlanLifecyclePreview,
  previewReadiness,
  visiblePreviewItems,
} from './PlanLifecyclePreview';
import type { PlanDraft } from './editor';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn(async () => ({ items: [] })) }));
const draft: PlanDraft = {
  title: 'Plan',
  purpose: 'NURTURE',
  sourceReviewId: null,
  sourceReviewVersion: null,
  sourceGoalRevisionId: null,
  sourceProfileVersion: null,
  items: ['first', 'second', 'last'].map((stableKey) => ({
    stableKey,
    clientTitle: stableKey,
    type: 'ACTION',
    completionMode: 'ACKNOWLEDGEMENT',
    owner: 'CLIENT',
    clientBody: null,
    consultantRationale: 'Private rationale',
    sortOrder: 0,
    required: true,
    pathKeys: [],
    status: 'LOCKED',
  })),
  paths: [],
  groups: [{ key: 'g', dependentKey: 'last', mode: 'ALL', prerequisites: ['first', 'second'] }],
};
test('All and Any prerequisites and multiple groups preserve their semantics', () => {
  const value = structuredClone(draft);
  value.items[0]!.status = 'COMPLETED';
  expect(previewReadiness(value, value.items[2]!, false).status).toBe('Locked');
  value.groups[0]!.mode = 'ANY';
  expect(previewReadiness(value, value.items[2]!, false).status).toBe('Ready');
  value.groups.push({ key: 'other', dependentKey: 'last', mode: 'ALL', prerequisites: ['second'] });
  expect(previewReadiness(value, value.items[2]!, false).status).toBe('Locked');
  expect(previewReadiness(value, value.items[2]!, true).status).toBe('Ready');
  value.items[2]!.status = 'AWAITING_VERIFICATION';
  expect(previewReadiness(value, value.items[2]!, true).status).toBe(
    'Awaiting consultant verification',
  );
});
test('path visibility follows active or available memberships and keeps shared steps', () => {
  const value = structuredClone(draft);
  value.paths = [
    { key: 'hidden', clientLabel: 'Later', internalLabel: null, status: 'INACTIVE', sortOrder: 0 },
    { key: 'open', clientLabel: 'Now', internalLabel: null, status: 'AVAILABLE', sortOrder: 1 },
  ];
  value.items[1]!.pathKeys = ['hidden'];
  value.items[2]!.pathKeys = ['hidden', 'open'];
  expect(visiblePreviewItems(value).map((item) => item.stableKey)).toEqual(['first', 'last']);
});
test('missing prerequisites stay locked even in the future scenario', () => {
  const value = structuredClone(draft);
  value.groups[0]!.prerequisites = ['missing'];
  expect(previewReadiness(value, value.items[2]!, true).status).toBe('Locked');
});
test('scenario switch updates readiness without mutating draft or showing private rationale', () => {
  const original = JSON.stringify(draft);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlanLifecyclePreview draft={draft} clientId="client" />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Locked')).toBeInTheDocument();
  expect(screen.getByText('Complete all of these')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('switch', { name: 'Preview after all prerequisites are completed' }),
  );
  expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  expect(screen.queryByText('Private rationale')).not.toBeInTheDocument();
  expect(JSON.stringify(draft)).toBe(original);
});
