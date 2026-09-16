import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { MajorReadinessPage } from './MajorReadinessPages';
vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
test('opens the case selected by focus and preserves identity across case sections', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    case: {
      id: 'case-one',
      clientId: 'client',
      intentType: 'MORTGAGE',
      status: 'COORDINATION',
      version: 1,
      decision: {
        type: 'PAUSE_CARD_ACTIVITY',
        clientSafeExplanation: 'Wait for consultant guidance',
      },
      recommendation: null,
      restrictions: [],
      timeline: [],
    },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/app/major-readiness/coordination?caseId=case-one']}>
        <MajorReadinessPage view="coordination" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Wait for consultant guidance')).toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith('/api/v1/major-readiness-v2/client/cases/case-one');
  expect(screen.getByRole('link', { name: 'Readiness' })).toHaveAttribute(
    'href',
    '/app/major-readiness/readiness?caseId=case-one',
  );
});
