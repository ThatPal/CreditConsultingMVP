import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { NavigationProtection } from '../NavigationProtection';
import { ClientPlanPage } from './PlanPages';
vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const plan = (id: string) => ({
  summary: {
    status: 'ACTIVE',
    canRespond: true,
    openActionCount: 1,
    completedActionCount: 0,
    totalActionCount: 1,
    progressPercent: 0,
    guidanceCount: 0,
    milestoneCount: 0,
    nextClientItem: { id, title: `Step ${id}`, status: 'AVAILABLE' },
  },
  plan: {
    id: 'plan',
    title: `Plan ${id}`,
    status: 'ACTIVE',
    version: {
      version: id === 'old' ? 1 : 2,
      staleAt: null,
      items: [
        {
          id,
          type: 'ACTION',
          availability: {
            canRespond: true,
            canSubmitCompletion: true,
            canRequestHelp: true,
            reason: null,
          },
          completionMode: 'ACKNOWLEDGEMENT',
          owner: 'CLIENT',
          status: 'AVAILABLE',
          title: `Step ${id}`,
          body: 'Preparation instructions',
          deepLink: null,
          prerequisites: [],
        },
      ],
    },
  },
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/app/plan',
        element: (
          <NavigationProtection>
            <ClientPlanPage />
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/app/plan?view=actions'] },
  );
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return client;
}
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') throw new Error('Save unavailable');
    if (path === '/api/v1/client/plan') return plan('old');
    return { active: true, contextVersion: '2026-09-10T00:00:00Z', draft: null };
  });
});
test('background replacement preserves unsaved answers and pauses writes until explicit loading', async () => {
  const client = setup();
  const input = await screen.findByRole('textbox', { name: 'Optional note for your consultant' });
  fireEvent.change(input, { target: { value: 'Keep these local answers' } });
  await screen.findByText('Save unavailable', {}, { timeout: 3000 });
  await act(async () => {
    client.setQueryData(['client-plan'], plan('new'));
  });
  await screen.findByRole('button', { name: 'Review Plan update' });
  expect(input).toHaveValue('Keep these local answers');
  expect(input).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save completed step' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Review Plan update' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep my answers open' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(input).toHaveValue('Keep these local answers');
  fireEvent.click(screen.getByRole('button', { name: 'Review Plan update' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load updated Plan' }));
  expect(await screen.findByRole('heading', { name: 'Plan new' })).toBeVisible();
  expect(
    await screen.findByRole('textbox', { name: 'Optional note for your consultant' }),
  ).toHaveValue('');
  expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
});
test('a running save prevents loading a replacement and newer local edits survive completion', async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT')
      return new Promise((resolve) => {
        finish = resolve;
      });
    if (path === '/api/v1/client/plan') return plan('old');
    return { active: true, contextVersion: '2026-09-10T00:00:00Z', draft: null };
  });
  const client = setup();
  const input = await screen.findByRole('textbox', { name: 'Optional note for your consultant' });
  fireEvent.change(input, { target: { value: 'First answer' } });
  await waitFor(() => expect(finish).toBeTypeOf('function'), { timeout: 3000 });
  fireEvent.change(input, { target: { value: 'Newer answer while saving' } });
  await act(async () => {
    client.setQueryData(['client-plan'], plan('new'));
  });
  expect(await screen.findByRole('button', { name: 'Review Plan update' })).toBeDisabled();
  await act(async () => {
    finish({
      active: true,
      contextVersion: '2026-09-10T00:00:00Z',
      draft: {
        revision: 1,
        values: {},
        note: 'First answer',
        help: false,
        files: [],
        unavailableFiles: 0,
        updatedAt: '2026-09-10T00:00:00Z',
      },
    });
  });
  expect(input).toHaveValue('Newer answer while saving');
  expect(screen.getByRole('button', { name: 'Review Plan update' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
});

test('changing Plan views preserves unsaved responses until explicit departure', async () => {
  setup();
  const input = await screen.findByRole('textbox', { name: 'Optional note for your consultant' });
  fireEvent.change(input, { target: { value: 'Keep my work while browsing' } });
  await screen.findByText('Save unavailable', {}, { timeout: 3000 });
  fireEvent.click(await screen.findByRole('link', { name: 'Overview' }));
  await screen.findByRole('dialog');
  expect(input).toHaveValue('Keep my work while browsing');
  fireEvent.click(screen.getByRole('button', { name: 'Stay on this page' }));
  expect(input).toHaveValue('Keep my work while browsing');
  fireEvent.click(await screen.findByRole('link', { name: 'Overview' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave without latest changes' }));
  await screen.findByRole('heading', { name: 'Your roadmap' });
  expect(
    screen.queryByRole('textbox', { name: 'Optional note for your consultant' }),
  ).not.toBeInTheDocument();
});

test.each(['old', 'new'])(
  'failed Plan check preserves answers, pauses writes and safely retries to %s',
  async (replacement) => {
    let fail = false;
    let recovered = false;
    request.mockImplementation(async (path, options) => {
      if (options?.method === 'PUT') throw new Error('Save unavailable');
      if (path === '/api/v1/client/plan') {
        if (fail) throw new Error('Plan read failed');
        return plan(recovered ? replacement : 'old');
      }
      return { active: true, contextVersion: '2026-09-10T00:00:00Z', draft: null };
    });
    const client = setup();
    const input = await screen.findByRole('textbox', { name: 'Optional note for your consultant' });
    fireEvent.change(input, { target: { value: 'Keep this answer through the failed check' } });
    await screen.findByText('Save unavailable', {}, { timeout: 3000 });
    fail = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['client-plan'] });
    });
    const retry = await screen.findByRole('button', { name: 'Retry Plan check' });
    expect(input).toHaveValue('Keep this answer through the failed check');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    const complete = screen.getByRole('button', { name: 'Save completed step' });
    expect(complete).toBeDisabled();
    fireEvent.submit(complete.closest('form')!);
    expect(request.mock.calls.filter(([path]) => path.endsWith('/outcomes'))).toHaveLength(0);
    fail = false;
    recovered = true;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry Plan check' })).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue('Keep this answer through the failed check');
    if (replacement === 'new') {
      expect(await screen.findByRole('button', { name: 'Review Plan update' })).toBeEnabled();
      expect(complete).toBeDisabled();
    } else expect(complete).toBeEnabled();
  },
);
