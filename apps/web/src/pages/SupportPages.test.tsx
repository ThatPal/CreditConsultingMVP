import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider';
import { theme } from '../theme';
import { ConsultantSupportPage } from './ConsultantSupportPage';
import { SupportPage } from './SupportPage';

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage(kind: 'client' | 'consultant', path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <AuthProvider
          initialUser={{
            userId: kind === 'client' ? 'client-user' : 'consultant-user',
            email: `${kind}@example.test`,
            role: kind === 'client' ? 'CLIENT' : 'CONSULTANT',
            status: 'ACTIVE',
            clientId: kind === 'client' ? 'client-1' : null,
            staffMfaEnabled: kind === 'consultant',
            staffMfaVerified: true,
            stepUpVerified: true,
            capabilities: kind === 'consultant' ? ['support.manage'] : [],
          }}
        >
          <MemoryRouter initialEntries={[path]}>
            {kind === 'client' ? <SupportPage /> : <ConsultantSupportPage />}
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PORTAL-39/40 support', () => {
  test('shows loading, empty, and safe error states', async () => {
    let resolveCases!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('support-cases'))
        return new Promise<Response>((resolve) => {
          resolveCases = resolve;
        });
      if (url.includes('support-categories')) return json({ categories: [] });
      return json({ documents: [] });
    });
    const first = renderPage('client');
    expect(document.querySelector('.AppLoadingSkeleton-root')).toBeInTheDocument();
    resolveCases(json({ cases: [] }));
    expect(await screen.findByRole('heading', { name: /how can we help/i })).toBeInTheDocument();
    first.unmount();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).includes('support-cases')
        ? json({ error: { message: 'storageKey secret/path' } }, 500)
        : json(String(input).includes('categories') ? { categories: [] } : { documents: [] }),
    );
    renderPage('client');
    expect(await screen.findByText('Unable to load support requests.')).toBeInTheDocument();
    expect(screen.queryByText(/storageKey/i)).not.toBeInTheDocument();
  });

  test('opens a safe thread and presents the complete create form', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('support-categories'))
        return json({
          categories: [
            { key: 'DOCUMENTS', name: 'Documents', allowedContextTypes: ['GENERAL', 'DOCUMENT'] },
          ],
        });
      if (url.endsWith('/documents/types'))
        return json({
          documentTypes: [
            {
              key: 'SUPPORT_ATTACHMENT',
              name: 'Support attachment',
              allowedMimeTypes: ['application/pdf'],
              allowedExtensions: ['.pdf'],
              maximumSizeBytes: 10 * 1024 * 1024,
            },
          ],
        });
      if (url.includes('/documents'))
        return json({
          documents: [{ id: 'document-1', displayFileName: 'report.pdf', status: 'AVAILABLE' }],
        });
      return json({
        cases: [
          {
            id: 'case-1',
            category: 'DOCUMENTS',
            priority: 'NORMAL',
            status: 'WAITING_ON_CLIENT',
            subject: 'Document question',
            createdAt: '2026-08-31T12:00:00Z',
            lastMessageAt: '2026-08-31T12:00:00Z',
            context: {
              type: 'DOCUMENT',
              resourceId: 'document-1',
              summary: 'Credit report: report.pdf',
            },
            attachments: [
              {
                id: 'attachment-1',
                document: {
                  id: 'document-1',
                  displayFileName: 'report.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 10,
                },
              },
            ],
            messages: [
              {
                id: 'message-1',
                body: 'Safe visible message',
                createdAt: '2026-08-31T12:00:00Z',
                author: { id: 'consultant-user', role: 'CONSULTANT' },
              },
            ],
          },
        ],
      });
    });
    renderPage('client');
    expect(await screen.findByText('Document question')).toBeInTheDocument();
    expect(screen.getByText(/Credit report: report.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Safe visible message')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.queryByText(/storageKey|LOCAL_DISK|secret\/path/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new request/i }));
    expect(screen.getByRole('dialog', { name: /new support request/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Subject' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'How can we help?' })).toBeInTheDocument();
    expect(screen.getByLabelText(/attach existing documents/i)).toBeInTheDocument();
    expect(screen.getByText(/attach a new file to this request/i)).toBeInTheDocument();
  });

  test('uploads a new support document, selects it, and preserves one ticket idempotency key', async () => {
    const createRequests: RequestInit[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/support-categories')) return json({ categories: [] });
      if (url.endsWith('/documents/types'))
        return json({
          documentTypes: [
            {
              key: 'SUPPORT_ATTACHMENT',
              name: 'Support attachment',
              allowedMimeTypes: ['application/pdf'],
              allowedExtensions: ['.pdf'],
              maximumSizeBytes: 10 * 1024 * 1024,
            },
          ],
        });
      if (url.endsWith('/documents') && init?.method === 'POST')
        return json(
          {
            document: {
              id: 'uploaded-support-document',
              displayFileName: 'support.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
            },
          },
          201,
        );
      if (url.endsWith('/documents')) return json({ documents: [] });
      if (url.endsWith('/support-cases') && init?.method === 'POST') {
        createRequests.push(init);
        return json({
          case: {
            id: 'case-new',
            category: 'CREDIT_REVIEW',
            priority: 'NORMAL',
            status: 'WAITING_ON_SUPPORT',
            subject: 'Uploaded evidence',
            createdAt: '2026-08-31T12:00:00Z',
            lastMessageAt: '2026-08-31T12:00:00Z',
            messages: [],
          },
        });
      }
      return json({ cases: [] });
    });
    renderPage('client');
    await screen.findByRole('heading', { name: /how can we help/i });
    fireEvent.click(screen.getByRole('button', { name: /create your first request/i }));
    fireEvent.change(screen.getByLabelText(/choose file to upload/i), {
      target: { files: [new File(['safe'], 'support.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText(/support.pdf uploaded successfully/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
      target: { value: 'Uploaded evidence' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'How can we help?' }), {
      target: { value: 'Please review this uploaded evidence.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(createRequests).toHaveLength(1));
    expect(JSON.parse(String(createRequests[0]!.body)).attachmentDocumentIds).toEqual([
      'uploaded-support-document',
    ]);
    expect((createRequests[0]!.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  });

  test('a failed direct upload does not submit or attach invalid state', async () => {
    let ticketCreates = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/support-categories')) return json({ categories: [] });
      if (url.endsWith('/documents/types'))
        return json({
          documentTypes: [
            {
              key: 'SUPPORT_ATTACHMENT',
              name: 'Support attachment',
              allowedMimeTypes: ['application/pdf'],
              allowedExtensions: ['.pdf'],
              maximumSizeBytes: 10 * 1024 * 1024,
            },
          ],
        });
      if (url.endsWith('/documents') && init?.method === 'POST')
        return json({ error: { message: 'The file could not be uploaded.' } }, 500);
      if (url.endsWith('/documents')) return json({ documents: [] });
      if (url.endsWith('/support-cases') && init?.method === 'POST') ticketCreates += 1;
      return json({ cases: [] });
    });
    renderPage('client');
    await screen.findByRole('heading', { name: /how can we help/i });
    fireEvent.click(screen.getByRole('button', { name: /create your first request/i }));
    fireEvent.change(screen.getByLabelText(/choose file to upload/i), {
      target: { files: [new File(['safe'], 'support.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText(/could not be uploaded/i)).toBeInTheDocument();
    expect(ticketCreates).toBe(0);
    expect(screen.getByLabelText(/attach existing documents/i)).not.toHaveTextContent(
      'support.pdf',
    );
  });
});

describe('CRM-22/23 consultant support', () => {
  test('shows empty and safe error states', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ cases: [] }));
    const first = renderPage('consultant');
    expect(await screen.findByRole('heading', { name: /queue clear/i })).toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json({ error: { message: 'private key' } }, 500),
    );
    renderPage('consultant');
    expect(await screen.findByText('Unable to load the support queue.')).toBeInTheDocument();
    expect(screen.queryByText(/private key/i)).not.toBeInTheDocument();
  });

  test('renders safe context, attachments, thread, reply, and lifecycle controls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        cases: [
          {
            id: 'case-2',
            category: 'DOCUMENTS',
            priority: 'HIGH',
            status: 'OPEN',
            updatedAt: '2026-08-31T12:00:00Z',
            subject: 'Review this document',
            client: {
              id: 'client-1',
              firstName: 'Jordan',
              lastName: 'Blake',
              user: { email: 'client@example.test' },
            },
            context: {
              type: 'DOCUMENT',
              resourceId: 'document-2',
              summary: 'Application: statement.pdf',
            },
            attachments: [
              {
                id: 'attachment-2',
                document: {
                  id: 'document-2',
                  displayFileName: 'statement.pdf',
                  mimeType: 'application/pdf',
                  sizeBytes: 12,
                },
              },
            ],
            messages: [
              {
                id: 'message-2',
                body: 'Please review this',
                internal: false,
                createdAt: '2026-08-31T12:00:00Z',
                author: { id: 'client-user', role: 'CLIENT' },
              },
            ],
          },
        ],
      }),
    );
    renderPage('consultant');
    expect((await screen.findAllByText('Review this document')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Validated context: Application: statement.pdf/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'statement.pdf' })).toBeInTheDocument();
    expect(screen.getByText('Please review this')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /reply to client/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /internal note/i })).toBeInTheDocument();
  });
});
