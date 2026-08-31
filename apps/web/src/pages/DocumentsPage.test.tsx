import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { DocumentsPage } from './DocumentsPage';

vi.mock('./ReviewPages', () => ({
  SecureReportViewer: () => <div>Secure viewer</div>,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DocumentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('PORTAL-42 document foundation', () => {
  test('renders safe document metadata and the enabled upload control', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/documents/types'))
        return json({
          documentTypes: [{ key: 'GENERAL_CLIENT_DOCUMENT', name: 'General document' }],
        });
      return json({
        documents: [
          {
            id: 'document-one',
            originalFileName: 'statement.pdf',
            displayFileName: 'statement.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            sha256: 'a'.repeat(64),
            status: 'AVAILABLE',
            clientVisible: true,
            uploadedAt: '2026-08-31T00:00:00.000Z',
            supersededAt: null,
            documentType: { key: 'GENERAL_CLIENT_DOCUMENT', name: 'General document' },
          },
        ],
      });
    });
    renderPage();
    expect(await screen.findByText('statement.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2 KB · General document/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByText(/storageKey/i)).not.toBeInTheDocument();
  });

  test('renders the responsive empty recovery state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/types') ? json({ documentTypes: [] }) : json({ documents: [] }),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: /no documents yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to credit profile/i })).toBeInTheDocument();
  });

  test('renders a safe error state without leaking server detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/types')
        ? json({ documentTypes: [] })
        : json({ error: { message: 'private storage root C:\\secret' } }, 500),
    );
    renderPage();
    expect(await screen.findByText(/unable to load your document history/i)).toBeInTheDocument();
    expect(screen.queryByText(/private storage root/i)).not.toBeInTheDocument();
  });
});
