import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { CardDetailPage, ExploreCardsPage } from './CardCatalogPages';
import { ClientPlanPage } from './PlanPages';
import { CardsPage } from './CardsPage';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const wrap = (node: React.ReactNode, path = '/') =>
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );

describe('APC Wave 3 client product contracts', () => {
  beforeEach(() => mockedApi.mockReset());

  test('keeps typed Plan outcomes isolated by item', async () => {
    mockedApi.mockResolvedValue({
      plan: {
        id: 'plan',
        title: 'Preparation path',
        status: 'ACTIVE',
        version: {
          staleAt: null,
          items: [
            {
              id: 'one',
              type: 'ACTION',
              completionMode: 'STRUCTURED_OUTCOME',
              status: 'AVAILABLE',
              title: 'First balance',
              body: 'First',
              deepLink: null,
              prerequisites: [],
            },
            {
              id: 'two',
              type: 'ACTION',
              completionMode: 'STRUCTURED_OUTCOME',
              status: 'AVAILABLE',
              title: 'Second balance',
              body: 'Second',
              deepLink: null,
              prerequisites: [],
            },
          ],
        },
      },
    });
    wrap(<ClientPlanPage />);
    const inputs = await screen.findAllByLabelText('What changed?');
    fireEvent.change(inputs[0]!, { target: { value: 'First account updated' } });
    expect(inputs[0]).toHaveValue('First account updated');
    expect(inputs[1]).toHaveValue('');
  });

  test('uses the scoped catalog detail contract', async () => {
    mockedApi.mockImplementation(async (url) => {
      if (String(url).endsWith('/offers')) return { offers: [] };
      return {
        product: {
          id: 'p1',
          slug: 'one',
          displayName: 'Card One',
          audience: 'PERSONAL',
          portfolioType: 'PERSONAL_CREDIT',
          secured: false,
          reportsToBureaus: true,
          tags: [],
          issuer: { name: 'Issuer', domain: null },
          currentOfferVersion: null,
          currentInsightVersion: null,
        },
      };
    });
    wrap(
      <Routes>
        <Route path="/app/cards/:productId" element={<CardDetailPage />} />
      </Routes>,
      '/app/cards/p1',
    );
    expect(await screen.findByRole('heading', { name: 'Card One', level: 1 })).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/api/v1/cards/catalog/p1');
    expect(mockedApi).not.toHaveBeenCalledWith('/api/v1/cards/catalog');
  });

  test('sends governed audience and portfolio facets to the catalog', async () => {
    mockedApi.mockResolvedValue({ products: [] });
    wrap(<ExploreCardsPage />, '/app/cards/explore');
    await screen.findByText('No catalog products match this search.');
    fireEvent.mouseDown(screen.getByLabelText('Card use'));
    fireEvent.click(await screen.findByRole('option', { name: 'Business' }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('audience=BUSINESS')),
    );
  });

  test('calculates portfolio totals from serialized decimal values', async () => {
    mockedApi.mockResolvedValue({
      cards: [
        {
          id: '1',
          cardName: 'One',
          issuer: 'Issuer',
          scope: 'PERSONAL',
          creditLimit: '18000',
          balance: '3400',
          accountStatus: 'OPEN',
          applicationOutcome: null,
          applicationSource: null,
          appliedAt: null,
        },
        {
          id: '2',
          cardName: 'Two',
          issuer: 'Issuer',
          scope: 'BUSINESS',
          creditLimit: '22000',
          balance: '1800',
          accountStatus: 'OPEN',
          applicationOutcome: null,
          applicationSource: null,
          appliedAt: null,
        },
      ],
      reviewSource: null,
    });
    wrap(<CardsPage />);
    expect(await screen.findByRole('heading', { name: '$40,000' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '$5,200' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '13.0%' })).toBeInTheDocument();
  });
});
