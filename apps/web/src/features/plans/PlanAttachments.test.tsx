import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest, apiBlobRequest, apiFileRequest } from '../../auth/api';
import { theme } from '../../theme';
import { PlanResponse, ResponseHistory, type ResponseItem } from './PlanResponse';

vi.mock('../../auth/api', () => ({
  apiRequest: vi.fn(),
  apiBlobRequest: vi.fn(),
  apiFileRequest: vi.fn(),
}));
const request = vi.mocked(apiRequest);
const item: ResponseItem = {
  id: 'step',
  type: 'ACTION',
  completionMode: 'ACKNOWLEDGEMENT',
  responseForm: { fields: [], error: null },
};
function setup(content: React.ReactNode) {
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        {content}
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  request.mockImplementation(async (path) =>
    path.includes('/types')
      ? { documentTypes: [] }
      : path.includes('/documents?')
        ? {
            documents: [
              {
                id: 'file-1',
                displayFileName: 'Statement.pdf',
                sizeBytes: 1000,
                status: 'AVAILABLE',
                uploadedAt: '2026-09-10',
                documentType: { key: 'report', name: 'Report' },
              },
            ],
            total: 1,
            hasMore: false,
          }
        : {},
  );
});
test('selects a private library file, retains it on failed submission and reuses its idempotency key', async () => {
  setup(<PlanResponse item={item} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add supporting documents (optional)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Attach existing documents' }));
  fireEvent.click(await screen.findByText('Statement.pdf'));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByRole('button', { name: 'Remove Statement.pdf' })).toBeEnabled();
  request.mockRejectedValueOnce(new Error('Connection interrupted'));
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await screen.findByText(/Connection interrupted/);
  expect(screen.getByRole('button', { name: 'Remove Statement.pdf' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await waitFor(() =>
    expect(request.mock.calls.filter(([path]) => path.includes('/outcomes'))).toHaveLength(2),
  );
  const payloads = request.mock.calls
    .filter(([path]) => path.includes('/outcomes'))
    .map(([, options]) => JSON.parse(String(options?.body)));
  expect(payloads[0].documentIds).toEqual(['file-1']);
  expect(payloads[1]).toEqual(payloads[0]);
});
test('shows original question labels and unavailable files without issuing a download', () => {
  setup(
    <ResponseHistory
      consultant
      item={{
        ...item,
        responseForm: {
          fields: [{ key: 'answer', label: 'New label', type: 'string', required: true }],
          error: null,
        },
        history: [
          {
            id: 'event',
            kind: 'COMPLETE',
            data: { answer: 'Saved answer' },
            createdAt: '2026-09-10',
            responseSnapshot: [
              { key: 'answer', label: 'Original label', type: 'string', required: true },
            ],
            attachments: [
              {
                documentId: 'file-1',
                fileName: 'Original.pdf',
                sizeBytes: 1000,
                status: 'DELETED',
                available: false,
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText('Original label: Saved answer')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Download Original.pdf' })).toBeDisabled();
  expect(apiBlobRequest).not.toHaveBeenCalled();
});

test('uploads within the response, blocks submission during upload, and removes selection without deleting the file', async () => {
  request.mockResolvedValue({
    documentTypes: [
      {
        key: 'general',
        name: 'General document',
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maximumSizeBytes: 100000,
      },
    ],
  });
  let finish!: (value: unknown) => void;
  vi.mocked(apiFileRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  setup(<PlanResponse item={item} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add supporting documents (optional)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Upload a new document' }));
  const input = await screen.findByLabelText('Choose file to upload');
  fireEvent.change(input, {
    target: { files: [new File(['synthetic'], 'Upload.pdf', { type: 'application/pdf' })] },
  });
  expect(screen.getByRole('button', { name: 'Save completed step' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel upload' })).toBeDisabled();
  finish({
    document: {
      id: 'uploaded',
      displayFileName: 'Upload.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
    },
  });
  const remove = await screen.findByRole('button', { name: 'Remove Upload.pdf' });
  await waitFor(() => expect(remove).toBeEnabled());
  fireEvent.click(remove);
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await waitFor(() =>
    expect(request.mock.calls.some(([path]) => path.includes('/outcomes'))).toBe(true),
  );
  const call = request.mock.calls.find(([path]) => path.includes('/outcomes'))!;
  expect(JSON.parse(String(call[1]?.body)).documentIds).toEqual([]);
  expect(request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
});

test('prefills only current available files when correcting a response', async () => {
  setup(
    <PlanResponse
      item={{
        ...item,
        history: [
          {
            id: 'old',
            kind: 'COMPLETE',
            data: {},
            createdAt: '2026-09-10',
            attachments: [
              {
                documentId: 'current',
                fileName: 'Current.pdf',
                sizeBytes: 100,
                status: 'AVAILABLE',
                available: true,
              },
              {
                documentId: 'old-file',
                fileName: 'Old.pdf',
                sizeBytes: 100,
                status: 'SUPERSEDED',
                available: true,
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Remove Current.pdf' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Remove Old.pdf' })).not.toBeInTheDocument();
  expect(screen.getByText(/Some files from your previous response/)).toBeVisible();
});

test('loads older history through the scoped endpoint and retains evidence after a failed page', async () => {
  request
    .mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce({
      history: [
        {
          id: 'old',
          kind: 'UNABLE',
          data: { reason: 'Earlier question' },
          createdAt: '2026-09-09',
        },
      ],
      historyLimited: false,
    });
  setup(
    <ResponseHistory
      consultant
      clientId="client-1"
      item={{
        ...item,
        historyLimited: true,
        history: [
          {
            id: 'new',
            kind: 'HELP_RESOLVED',
            data: { note: 'Latest reply' },
            createdAt: '2026-09-10',
          },
        ],
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load older responses' }));
  expect(await screen.findByText(/Connection interrupted/)).toBeVisible();
  expect(screen.getByText('Note: Latest reply')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Load older responses' }));
  expect(await screen.findByText('Note: Earlier question')).toBeVisible();
  expect(screen.getByText('Note: Latest reply')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Load older responses' })).not.toBeInTheDocument();
  expect(request).toHaveBeenLastCalledWith(
    '/api/v1/consultant/clients/client-1/plan/items/step/history?before=new',
  );
});
