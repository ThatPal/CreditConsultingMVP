import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const documentType = {
  key: 'GENERAL_CLIENT_DOCUMENT',
  name: 'General document',
  allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  maximumSizeBytes: 10 * 1024 * 1024,
};

afterEach(() => vi.restoreAllMocks());

describe('PORTAL-42 document foundation', () => {
  test('renders safe document metadata and the enabled upload control', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/documents/types'))
        return json({
          documentTypes: [documentType],
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
    expect(screen.getByRole('button', { name: /select file/i })).toBeInTheDocument();
    expect(
      screen.getByText(/accepted: \.pdf, \.png, \.jpg, \.jpeg up to 10 mb/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByText(/storageKey/i)).not.toBeInTheDocument();
  });

  test.each(['click', 'drop'] as const)('uploads by %s and refreshes the list', async (method) => {
    let listRequests = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/types')) return json({ documentTypes: [documentType] });
      if (init?.method === 'POST')
        return json(
          {
            document: {
              id: 'new-document',
              displayFileName: 'evidence.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 12,
            },
          },
          201,
        );
      listRequests += 1;
      return json({ documents: [] });
    });
    renderPage();
    await screen.findByRole('button', { name: /select file/i });
    const file = new File(['safe'], 'evidence.pdf', { type: 'application/pdf' });
    if (method === 'click') {
      fireEvent.change(screen.getByLabelText(/choose file to upload/i), {
        target: { files: [file] },
      });
    } else {
      fireEvent.drop(screen.getByTestId('document-upload-dropzone'), {
        dataTransfer: { files: [file] },
      });
    }
    expect(await screen.findByText(/evidence.pdf uploaded successfully/i)).toBeInTheDocument();
    await waitFor(() => expect(listRequests).toBeGreaterThan(1));
  });

  test('explains invalid files and remains recoverable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/types')
        ? json({ documentTypes: [documentType] })
        : json({ documents: [] }),
    );
    renderPage();
    await screen.findByRole('button', { name: /select file/i });
    fireEvent.change(screen.getByLabelText(/choose file to upload/i), {
      target: { files: [new File(['unsafe'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByText(/choose an accepted file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select file/i })).toBeEnabled();
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
