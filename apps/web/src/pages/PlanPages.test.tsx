import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { ConsultantPlanBuilderPage } from './PlanPages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);

describe('consultant Plan Builder continuity', () => {
  beforeEach(() => mockedApi.mockReset());

  test('hydrates the canonical saved draft instead of replacing it with starter content', async () => {
    mockedApi.mockResolvedValue({
      plan: {
        id: 'plan-1',
        title: 'Jordan rebuilding plan',
        status: 'DRAFT',
        versions: [
          {
            version: 4,
            optimisticVersion: 7,
            sourceProfileVersion: 3,
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
    expect(screen.getByDisplayValue('Keep this saved action')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Review your credit findings')).not.toBeInTheDocument();
  });
});
