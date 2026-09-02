import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { PublishedCreditCenterPage } from './PublishedCreditCenterPages';

function renderPage(view: 'overview' | 'profile' | 'report' | 'analysis' | 'history' = 'overview') {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <PublishedCreditCenterPage view={view} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Sprint 8.4 published Credit Center', () => {
  test('shows an honest empty state and no invented score', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ current: null, history: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPage();
    expect(await screen.findByText(/No Credit Review has been published yet/i)).toBeInTheDocument();
    expect(screen.queryByText('718')).not.toBeInTheDocument();
  });

  test('renders only the published analysis and secure report link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          current: {
            id: 'publication-1',
            reviewId: 'review-1',
            publishedAt: '2026-09-02T12:00:00Z',
            recommendation: 'PREPARE_FIRST',
            projection: {
              profile: { experianScore: 720 },
              analysisSummary: 'Published summary',
              findings: [
                {
                  code: 'one',
                  title: 'Approved finding',
                  summary: 'Client-safe detail',
                  severity: 'CAUTION',
                },
              ],
              recommendation: {
                outcome: 'PREPARE_FIRST',
                explanation: 'Published explanation',
                reasons: ['Lower utilization'],
              },
            },
            report: {
              id: 'document-1',
              originalFileName: 'credit-report.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              uploadedAt: '2026-09-01T12:00:00Z',
              reportDate: '2026-09-01T12:00:00Z',
              reportSource: 'Three bureau',
              contentPath: '/api/v1/reviews/report-documents/document-1/content',
            },
          },
          history: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const { rerender } = renderPage('analysis');
    expect(await screen.findByText('Published explanation')).toBeInTheDocument();
    expect(screen.getByText('Approved finding')).toBeInTheDocument();
    rerender(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <PublishedCreditCenterPage view="report" />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByRole('link', { name: /open secure report/i })).toHaveAttribute(
      'href',
      '/api/v1/reviews/report-documents/document-1/content',
    );
  });
});
