import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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
