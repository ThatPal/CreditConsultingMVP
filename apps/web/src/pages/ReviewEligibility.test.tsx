import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { ClientReviewPage } from './ReviewPages';

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ClientReviewPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PORTAL-10 and PORTAL-11 Review eligibility', () => {
  test('shows the eligibility explanation and starts with an idempotency key', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/client/cards')) return json({ cards: [] });
      if (url.includes('/client/eligibility'))
        return json({
          eligibility: {
            state: 'ELIGIBLE',
            eligible: true,
            reason: 'This report is newer than the latest accepted report.',
            intendedReportDate: '2026-09-02',
            latestAcceptedReportDate: '2026-08-01',
            activeReviewId: null,
            credits: { available: 1, reserved: 0, consumed: 0, expired: 0 },
            nextPath: '/app/credit-center/review',
          },
        });
      if (init?.method === 'POST') return json({ review: { id: 'review-1' } });
      return json({ review: null });
    });
    renderPage();
    expect(await screen.findByText(/newer than the latest accepted report/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start credit review/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reviews/client'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        }),
      ),
    );
  });

  test('routes the no-credit state to Services and does not expose a start action', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/client/cards')) return json({ cards: [] });
      if (url.includes('/client/eligibility'))
        return json({
          eligibility: {
            state: 'PURCHASE_REQUIRED',
            eligible: false,
            reason: 'One available Review Credit is required to begin.',
            intendedReportDate: '2026-09-02',
            latestAcceptedReportDate: null,
            activeReviewId: null,
            credits: { available: 0, reserved: 0, consumed: 0, expired: 0 },
            nextPath: '/app/services',
          },
        });
      return json({ review: null });
    });
    renderPage();
    expect(await screen.findByRole('link', { name: /get a review credit/i })).toHaveAttribute(
      'href',
      '/app/services',
    );
    expect(screen.queryByRole('button', { name: /start credit review/i })).not.toBeInTheDocument();
  });
});
