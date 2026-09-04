import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { Client360Page, ClientsPage } from './ClientContextPages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);

function renderWithContext(element: React.ReactNode, path = '/crm/clients') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('Sprint 4.1 consultant client context', () => {
  beforeEach(() => mockedApi.mockReset());

  test('renders the real bounded directory and canonical counts', async () => {
    mockedApi.mockResolvedValue({
      clients: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          firstName: 'Jordan',
          lastName: 'Blake',
          phone: null,
          timezone: 'America/New_York',
          status: 'ACTIVE',
          assignedConsultant: { id: 'staff', name: 'Casey', email: 'casey@example.test' },
          user: { email: 'jordan@example.test' },
          _count: { businesses: 2, financialRelationships: 3, workItems: 4 },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    renderWithContext(<ClientsPage />);
    expect(await screen.findByText('Jordan Blake')).toBeInTheDocument();
    expect(screen.getByText('2 businesses')).toBeInTheDocument();
    expect(screen.getByText('4 active items')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Client 360/i })).toHaveAttribute(
      'href',
      '/crm/clients/11111111-1111-4111-8111-111111111111',
    );
    expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('pageSize=20'));
  });

  test('renders honest Client 360 context without future metrics or secret fields', async () => {
    mockedApi.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/support-summary'))
        return {
            cases: [
              {
                id: 'support-1',
                subject: 'Round question',
                status: 'OPEN',
                priority: 'HIGH',
                lastMessageAt: new Date().toISOString(),
              },
            ],
          };
      if (String(url).endsWith('/timeline'))
        return {
          events: [
            {
              id: 'event-1',
              action: 'PLAN_APPROVED',
              entityType: 'Plan',
              source: 'APPLICATION',
              createdAt: '2026-09-04T00:00:00.000Z',
              deepLink: '/crm/clients/11111111-1111-4111-8111-111111111111/plan',
              actor: { name: 'Casey' },
            },
          ],
        };
      if (String(url).endsWith('/journey')) return { journey: null };
      if (String(url).endsWith('/services')) return { balance: null };
      return {
            client: {
              id: '11111111-1111-4111-8111-111111111111',
              firstName: 'Jordan',
              lastName: 'Blake',
              phone: null,
              timezone: 'America/New_York',
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              user: { email: 'jordan@example.test' },
              assignedConsultant: { id: 'staff', name: 'Casey', email: 'casey@example.test' },
              businesses: [
                {
                  id: 'business',
                  legalName: 'Blake Studio LLC',
                  displayName: 'Blake Studio',
                  entityType: 'LLC',
                  industry: null,
                  status: 'ACTIVE',
                },
              ],
              financialRelationships: [
                {
                  id: 'relationship',
                  institutionName: 'Community Credit Union',
                  relationshipType: 'CHECKING',
                  approximateTenure: 'About 3 years',
                  status: 'ACTIVE',
                  clientBusiness: null,
                },
              ],
            },
          };
    });
    renderWithContext(
      <Routes>
        <Route path="/crm/clients/:clientId" element={<Client360Page />} />
      </Routes>,
      '/crm/clients/11111111-1111-4111-8111-111111111111',
    );
    expect(await screen.findByRole('heading', { name: 'Jordan Blake' })).toBeInTheDocument();
    expect(screen.getByText('Blake Studio')).toBeInTheDocument();
    expect(screen.getByText('Community Credit Union')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Round question/i })).toHaveAttribute(
      'href',
      '/crm/support?case=support-1',
    );
    expect(await screen.findByRole('link', { name: /PLAN APPROVED/i })).toHaveAttribute(
      'href',
      '/crm/clients/11111111-1111-4111-8111-111111111111/plan',
    );
    expect(
      screen.getByText(
        /Account numbers, balances, and online-banking credentials are never stored/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/credit score|revenue|balance:/i)).not.toBeInTheDocument();
  });
});
