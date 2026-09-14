import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { NavigationProtection, useNavigationProtection } from '../../NavigationProtection';
import { planRecoveryKey } from '../../auth/tabRecovery';
import { apiRequest } from '../../auth/api';
import { PlanLibrary } from './PlanLibrary';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
function Guard() {
  useNavigationProtection(true, false);
  return <PlanLibrary clientId="client" />;
}
test('retains loaded Plans on paging failure and guards query navigation with unsaved work', async () => {
  let attempts = 0;
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path.includes('before=')) {
      attempts++;
      if (attempts === 1) throw new Error('offline');
      return { plans: [], nextBefore: null };
    }
    return {
      plans: [
        {
          id: 'older',
          title: 'Older preparation',
          status: 'DRAFT',
          updatedAt: '2026-09-10T00:00:00Z',
          versions: [],
        },
      ],
      nextBefore: 'older',
    };
  });
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationProtection>
            <Guard />
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/plan?view=work'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Browse client Plans' }));
  await screen.findByText('Older preparation');
  expect(screen.getByRole('link', { name: 'Start a separate Plan' })).toHaveAttribute(
    'href',
    '/plan?view=work&planId=new',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load more Plans' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry Plans' }));
  expect(screen.getByText('Older preparation')).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Open Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Stay on this page' }));
  expect(router.state.location.search).toBe('?view=work');
  fireEvent.click(await screen.findByRole('button', { name: 'Browse client Plans' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Open Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave without latest changes' }));
  expect(router.state.location.search).toBe('?view=work&planId=older');
  expect(vi.mocked(apiRequest).mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
test('recovery keys isolate selected Plans, clients and actors', () => {
  expect(
    new Set([
      planRecoveryKey('a', 'c'),
      planRecoveryKey('a', 'c', 'p'),
      planRecoveryKey('a', 'c', 'q'),
      planRecoveryKey('b', 'c', 'p'),
      planRecoveryKey('a', 'd', 'p'),
    ]).size,
  ).toBe(5);
});

test('searches the server, retains empty-result controls and clears filters without navigation', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ plans: [], nextBefore: null });
  const router = createMemoryRouter(
    [{ path: '*', element: <PlanLibrary clientId="search-client" /> }],
    { initialEntries: ['/plan?planId=selected&view=work'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Browse client Plans' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search Plan titles' }), {
    target: { value: 'Renamed & retained' },
  });
  await waitFor(() =>
    expect(
      vi
        .mocked(apiRequest)
        .mock.calls.some(([path]) => path.includes('search=Renamed+%26+retained')),
    ).toBe(true),
  );
  expect(await screen.findByText(/No Plans match/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search Plan titles' })).toHaveValue(
    'Renamed & retained',
  );
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Plan status' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Cancelled' }));
  await waitFor(() =>
    expect(
      vi
        .mocked(apiRequest)
        .mock.calls.some(([path]) => path.includes('status=CANCELLED') && path.includes('search=')),
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and status' }));
  await screen.findByText(/No saved Plans yet/);
  expect(router.state.location.search).toBe('?planId=selected&view=work');
  expect(screen.getByRole('textbox', { name: 'Search Plan titles' })).toHaveValue('');
});

test('names the library dialog, focuses search, and restores focus after Escape', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ plans: [], nextBefore: null });
  const router = createMemoryRouter([
    { path: '*', element: <PlanLibrary clientId="keyboard-client" /> },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'Browse client Plans' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(await screen.findByRole('dialog', { name: 'Client Plans' })).toBeVisible();
  const search = screen.getByRole('textbox', { name: 'Search Plan titles' });
  await waitFor(() => expect(search).toHaveFocus());
  fireEvent.keyDown(search, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Client Plans' })).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});
