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
    expect(await screen.findByText(/No published Credit Review yet/i)).toBeInTheDocument();
    expect(screen.queryByText('718')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ask about this review' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ask about credit reviews' }).getAttribute('href'),
    ).not.toContain('contextId');
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
    expect(screen.getByRole('link', { name: 'Ask about this review' })).toHaveAttribute(
      'href',
      '/app/support?new=1&category=CREDIT_REVIEW&subject=Question%20about%20my%20Credit%20Review&contextType=CREDIT_REVIEW&contextId=review-1',
    );
    rerender(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <PublishedCreditCenterPage view="report" />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(
      await screen.findByRole('link', { name: /preview secure source report/i }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/api/v1/reviews/report-documents/document-1/content'),
    );
  });

  test('renders only factual published score and utilization visualizations with provenance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          current: {
            id: 'publication-2',
            reviewId: 'review-2',
            publishedAt: '2026-09-02T12:00:00Z',
            recommendation: 'PREPARE_FIRST',
            projection: {
              profile: { experianScore: 720, aggregateUtilization: 24, openAccounts: 5 },
              analysisSummary: 'Use the approved Plan to address the published findings.',
            },
            report: null,
          },
          history: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderPage();
    expect(await screen.findByText('720')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /credit utilization 24 percent/i })).toBeInTheDocument();
    expect(screen.getByText('Equifax')).toBeInTheDocument();
    expect(screen.getByText('TransUnion')).toBeInTheDocument();
    expect(screen.getAllByText('Not available in this report').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/approval probability|score improvement/i)).not.toBeInTheDocument();
  });
});

test('separates expired currentness from the immutable published summary', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        current: {
          id: 'published',
          reviewId: 'review',
          publishedAt: '2026-09-01',
          recommendation: 'PREPARE_FIRST',
          projection: { analysisSummary: 'Original approved analysis', profile: {} },
          report: null,
        },
        history: [],
        workspace: {
          profile: { isCurrent: false, reason: 'EXPIRED' },
          currentFocus: {
            title: 'Your consultant is checking your update',
            detail: 'Your update is saved.',
            action: '/app/plan',
            actionLabel: 'View your Plan',
          },
          plan: { openActionCount: 2, completedActionCount: 1 },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  renderPage();
  expect(await screen.findByText('Your published assessment has expired')).toBeInTheDocument();
  expect(screen.getByText('Original approved analysis')).toBeInTheDocument();
  expect(screen.getByText('Actions remaining: 2 · 1 completed')).toBeInTheDocument();
  expect(screen.getByText('Your consultant is checking your update')).toBeInTheDocument();
});
