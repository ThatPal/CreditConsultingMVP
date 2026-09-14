import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, Route, RouterProvider, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { apiRequest } from './api';
import { NavigationProtection, useNavigationProtection } from '../NavigationProtection';
import { SavedPlanResponse } from '../features/plans/SavedPlanResponse';
import { PlanResponse } from '../features/plans/PlanResponse';
import { DocumentUploadDropzone } from '../components/common/DocumentUploadDropzone';

const uploaded = vi.fn();
function Upload() {
  const [busy, setBusy] = useState(false);
  useNavigationProtection(false, busy);
  return (
    <DocumentUploadDropzone
      documentType={{
        key: 'PROOF',
        name: 'Proof',
        allowedMimeTypes: ['text/plain'],
        allowedExtensions: ['.txt'],
        maximumSizeBytes: 1000,
      }}
      onUploaded={uploaded}
      onBusyChange={setBusy}
    />
  );
}
function setup(
  content: React.ReactNode,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationProtection>
            <Routes>
              <Route path="/login" element={<h1>Sign in again</h1>} />
              <Route element={<ProtectedRoute roles={['CLIENT']} />}>
                <Route
                  path="/app/plan"
                  element={
                    <>
                      {content}
                      <Link to="/app">Home</Link>
                      <button
                        onClick={() => {
                          void apiRequest('/expiry-proof').catch(() => undefined);
                        }}
                      >
                        Expire
                      </button>
                    </>
                  }
                />
                <Route path="/app" element={<h1>Home</h1>} />
              </Route>
            </Routes>
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/app/plan?step=proof#response'] },
  );
  render(
    <QueryClientProvider client={client}>
      <AuthProvider
        initialUser={{
          userId: 'u',
          clientId: 'c',
          email: 'synthetic@example.test',
          role: 'CLIENT',
          status: 'ACTIVE',
        }}
      >
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}
afterEach(() => {
  vi.restoreAllMocks();
  uploaded.mockClear();
});

test.each([true, false])(
  'expiry releases a dirty response (dialog already open: %s) and retains the return path',
  async (blocked) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const router = setup(
      <PlanResponse item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
      target: { value: 'Unsaved private answer' },
    });
    if (blocked) {
      fireEvent.click(screen.getByRole('link', { name: 'Home' }));
      expect(await screen.findByRole('dialog')).toBeVisible();
    }
    await act(async () => {
      await apiRequest('/expiry-proof').catch(() => undefined);
    });
    expect(await screen.findByRole('heading', { name: 'Sign in again' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.state).toMatchObject({
      from: '/app/plan?step=proof#response',
      sessionExpired: true,
    });
    expect(screen.queryByDisplayValue('Unsaved private answer')).not.toBeInTheDocument();
  },
);

test('expiry during upload leaves securely and ignores a late successful upload callback', async () => {
  let finish!: (response: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).endsWith('/expiry-proof')
      ? new Response('{}', { status: 401 })
      : new Promise<Response>((resolve) => {
          finish = resolve;
        }),
  );
  setup(<Upload />);
  fireEvent.change(screen.getByLabelText('Choose file to upload'), {
    target: { files: [new File(['proof'], 'proof.txt', { type: 'text/plain' })] },
  });
  expect(await screen.findByRole('progressbar')).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  await act(async () => {
    await apiRequest('/expiry-proof').catch(() => undefined);
  });
  expect(await screen.findByRole('heading', { name: 'Sign in again' })).toBeVisible();
  const uploadCall = vi
    .mocked(fetch)
    .mock.calls.find(([input]) => String(input).endsWith('/api/v1/documents'));
  expect(uploadCall?.[1]?.signal?.aborted).toBe(true);
  await act(async () => {
    finish(
      new Response(
        JSON.stringify({
          document: {
            id: 'file',
            displayFileName: 'proof.txt',
            sizeBytes: 5,
            mimeType: 'text/plain',
          },
        }),
        { status: 200 },
      ),
    );
  });
  expect(uploaded).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a draft save completing after expiry cannot repopulate the private cache', async () => {
  let finish!: (response: Response) => void;
  const result = { active: true, contextVersion: 'v1', draft: null };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).endsWith('/expiry-proof')) return new Response('{}', { status: 401 });
    if (init?.method === 'PUT')
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    return new Response(JSON.stringify(result), { status: 200 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setup(
    <SavedPlanResponse item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }} />,
    client,
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Optional note for your consultant' }),
    { target: { value: 'Private pending answer' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  await act(async () => {
    await apiRequest('/expiry-proof').catch(() => undefined);
  });
  expect(await screen.findByRole('heading', { name: 'Sign in again' })).toBeVisible();
  await act(async () => {
    finish(
      new Response(
        JSON.stringify({ ...result, draft: { note: 'Private pending answer', revision: 1 } }),
        { status: 200 },
      ),
    );
  });
  expect(client.getQueryData(['plan-response-draft', 'step'])).toBeUndefined();
});

test('upload rejection permits retry and a successful retry releases navigation', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Upload unavailable' }), { status: 503 }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          document: {
            id: 'file',
            displayFileName: 'proof.txt',
            sizeBytes: 5,
            mimeType: 'text/plain',
          },
        }),
        { status: 200 },
      ),
    );
  const router = setup(<Upload />);
  const select = () =>
    fireEvent.change(screen.getByLabelText('Choose file to upload'), {
      target: { files: [new File(['proof'], 'proof.txt', { type: 'text/plain' })] },
    });
  select();
  expect(await screen.findByText('Upload unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Select file' })).toBeEnabled();
  select();
  expect(await screen.findByText('proof.txt uploaded successfully.')).toBeVisible();
  expect(uploaded).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an upload 401 itself initiates the secure sign-in handoff', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
  const router = setup(<Upload />);
  fireEvent.change(screen.getByLabelText('Choose file to upload'), {
    target: { files: [new File(['proof'], 'proof.txt', { type: 'text/plain' })] },
  });
  expect(await screen.findByRole('heading', { name: 'Sign in again' })).toBeVisible();
  expect(router.state.location.state).toMatchObject({
    sessionExpired: true,
    from: '/app/plan?step=proof#response',
  });
  expect(uploaded).not.toHaveBeenCalled();
});
