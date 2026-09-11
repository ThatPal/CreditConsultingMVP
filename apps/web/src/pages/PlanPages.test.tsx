import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { ClientPlanPage, ConsultantPlanBuilderPage } from './PlanPages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);

describe('consultant Plan Builder continuity', () => {
  beforeEach(() => mockedApi.mockReset());

  test.each([
    { status: 'STALE', owner: 'CLIENT', staleAt: '2026-09-10T12:00:00Z' },
    { status: 'ACTIVE', owner: 'CONSULTANT', staleAt: null },
  ])(
    'does not offer client completion for $status / $owner work',
    async ({ status, owner, staleAt }) => {
      mockedApi.mockResolvedValue({
        plan: {
          id: 'plan',
          title: 'Preparation',
          status,
          version: {
            staleAt,
            items: [
              {
                id: 'item',
                type: 'ACTION',
                completionMode: 'ACKNOWLEDGEMENT',
                status: 'AVAILABLE',
                owner,
                title: 'Check the source',
                body: 'Review the source record.',
                prerequisites: [],
                deepLink: null,
              },
            ],
          },
        },
      });
      render(
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>
              <ClientPlanPage />
            </MemoryRouter>
          </QueryClientProvider>
        </ThemeProvider>,
      );
      await screen.findByRole('heading', { name: 'Preparation' });
      expect(screen.queryByRole('button', { name: 'Report complete' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'I need help' })).not.toBeInTheDocument();
    },
  );

  test('hydrates the canonical saved draft instead of replacing it with starter content', async () => {
    mockedApi.mockResolvedValue({
      plan: {
        id: 'plan-1',
        title: 'Jordan rebuilding plan',
        status: 'DRAFT',
        purpose: 'NURTURE',
        versions: [
          {
            version: 4,
            optimisticVersion: 7,
            sourceProfileVersion: 3,
            sourceReviewId: 'saved-review',
            sourceReviewVersion: 6,
            sourceGoalRevisionId: 'saved-goal-revision',
            paths: [
              {
                key: 'primary',
                clientLabel: 'Primary path',
                internalLabel: 'Keep this path',
                status: 'ACTIVE',
                sortOrder: 0,
              },
            ],
            items: [
              {
                stableKey: 'saved-step',
                type: 'ACTION',
                completionMode: 'ACKNOWLEDGEMENT',
                owner: 'CLIENT',
                clientTitle: 'Keep this saved action',
                clientBody: 'Saved guidance',
                consultantRationale: 'Saved rationale',
                sortOrder: 0,
                required: true,
                pathMemberships: [{ path: { key: 'primary' } }],
                prerequisites: [
                  {
                    prerequisiteItem: { stableKey: 'later-display-step' },
                    groupKey: 'choice',
                    mode: 'ANY',
                  },
                ],
                outcomeSchema: { required: ['balance'] },
                deepLink: '/app/credit-center',
              },
              {
                stableKey: 'later-display-step',
                type: 'GUIDANCE',
                completionMode: 'ACKNOWLEDGEMENT',
                owner: 'CLIENT',
                clientTitle: 'Independent guidance',
                clientBody: null,
                consultantRationale: null,
                sortOrder: 1,
                required: false,
                pathMemberships: [],
                prerequisites: [],
              },
            ],
          },
        ],
      },
      context: { review: { id: 'review-1' } },
    });
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/crm/clients/client-1/plan']}>
            <Routes>
              <Route path="/crm/clients/:clientId/plan" element={<ConsultantPlanBuilderPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByDisplayValue('Jordan rebuilding plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-three-zone-workbench')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan structure')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan item authoring')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan context and client preview')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Keep this saved action')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Review your credit findings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(mockedApi.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    const saved = mockedApi.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    // apiRequest supplies Content-Type. A lowercase duplicate combines into an
    // invalid media type in fetch and Express then leaves req.body undefined.
    expect(saved[1]?.headers).toBeUndefined();
    const payload = JSON.parse(String(saved[1]?.body));
    expect(payload.draft).toMatchObject({
      purpose: 'NURTURE',
      sourceReviewId: 'saved-review',
      sourceReviewVersion: 6,
      sourceGoalRevisionId: 'saved-goal-revision',
      sourceProfileVersion: 3,
    });
    expect(payload.draft.dependencies).toEqual([
      {
        dependentKey: 'saved-step',
        prerequisiteKey: 'later-display-step',
        groupKey: 'choice',
        mode: 'ANY',
      },
    ]);
    expect(payload.draft.paths[0]).toMatchObject({ key: 'primary', status: 'ACTIVE' });
    expect(payload.draft.items[0]).toMatchObject({
      deepLink: '/app/credit-center',
      outcomeSchema: { required: ['balance'] },
    });
  });
});

test('removes the draft form after successful client completion while retaining history', async () => {
  let completed = false;
  mockedApi.mockReset();
  mockedApi.mockImplementation(async (path) => {
    if (path.endsWith('/draft'))
      return { active: true, contextVersion: '2026-09-10T00:00:00.000Z', draft: null };
    if (path.endsWith('/outcomes')) {
      completed = true;
      return { outcomeId: 'done' };
    }
    return {
      plan: {
        id: 'plan',
        title: 'Draft lifecycle',
        status: 'ACTIVE',
        version: {
          staleAt: null,
          items: [
            {
              id: 'step',
              type: 'ACTION',
              completionMode: 'ACKNOWLEDGEMENT',
              status: completed ? 'COMPLETED' : 'AVAILABLE',
              owner: 'CLIENT',
              title: 'Gather questions',
              body: 'Prepare your questions',
              prerequisites: [],
              deepLink: null,
              latestOutcomeId: completed ? 'done' : null,
              history: completed
                ? [
                    {
                      id: 'done',
                      kind: 'COMPLETE',
                      data: { note: 'My questions' },
                      createdAt: '2026-09-10',
                    },
                  ]
                : [],
            },
          ],
        },
      },
    };
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ClientPlanPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Optional note for your consultant' }),
    { target: { value: 'My questions' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await screen.findByRole('heading', { name: 'Your Plan steps are complete' });
  await waitFor(() =>
    expect(
      screen.queryByRole('textbox', { name: 'Optional note for your consultant' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  expect(screen.getByText('Response history · 1')).toBeInTheDocument();
});
