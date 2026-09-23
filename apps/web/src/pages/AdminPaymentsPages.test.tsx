import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { AdminPaymentsPage } from './AdminPaymentsPages';
import { apiRequest } from '../auth/api';
vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mock = vi.mocked(apiRequest);
const row = (name: string) => ({
  id: name,
  client: { firstName: name, lastName: 'Reference' },
  provider: 'STRIPE',
  environment: 'SANDBOX',
  state: 'PENDING',
  amount: '41.00',
  currency: 'USD',
  createdAt: '2026-09-22T12:00:00Z',
});
const result = (name: string) => ({
  payments: name === 'Beta' ? [row(name), row('Beta second')] : name ? [row(name)] : [],
  total: name === 'Beta' ? 2 : name ? 1 : 0,
  pageSize: 20,
});
beforeEach(() => {
  mock.mockReset();
  mock.mockImplementation(async (path) => {
    if (path.includes('/refunds')) return { refunds: [] };
    if (path.includes('/disputes')) return { disputes: [] };
    const q = new URL(path, 'http://test').searchParams;
    return result(q.get('search') || 'All');
  });
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/admin/payments', element: <AdminPaymentsPage /> }], {
    initialEntries: ['/admin/payments?page=1&search=Alpha'],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
test('R3 page-one search change, normalized URL, clear and Back select the correct data', async () => {
  const router = mount();
  await screen.findByText('Alpha Reference');
  fireEvent.change(screen.getByLabelText('Search payments'), { target: { value: '  Beta  ' } });
  await screen.findByText('Beta Reference');
  expect(mock).toHaveBeenCalledWith(expect.stringContaining('search=Beta'));
  expect(screen.queryByText('Alpha Reference')).toBeNull();
  expect(screen.getByText('2 payments')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Clear search payments'));
  await screen.findByText('All Reference');
  await act(async () => {
    await router.navigate(-1);
  });
  await screen.findByText('Beta Reference');
  await act(async () => {
    await router.navigate('/admin/payments?page=1&search=Alpha&provider=PAYPAL&state=PENDING');
  });
  await screen.findByText('Alpha Reference');
  expect(mock).toHaveBeenCalledWith(
    '/api/v1/admin/payments?page=1&pageSize=20&provider=PAYPAL&state=PENDING&search=Alpha',
  );
});
test('R3 delayed old search cannot replace a newer completed result; no-match and clear recover', async () => {
  const router = mount();
  await screen.findByText('Alpha Reference');
  let release!: (v: unknown) => void;
  const original = mock.getMockImplementation()!;
  mock.mockImplementation((path, ...rest) =>
    path.includes('search=Slow')
      ? new Promise((r) => {
          release = r;
        })
      : path.includes('search=Missing')
        ? Promise.resolve(result(''))
        : original(path, ...rest),
  );
  fireEvent.change(screen.getByLabelText('Search payments'), { target: { value: 'Slow' } });
  await waitFor(() => expect(release).toBeDefined());
  expect(screen.queryByText('Alpha Reference')).toBeNull();
  await act(async () => {
    await router.navigate('/admin/payments?page=1&search=Beta');
  });
  await screen.findByText('Beta Reference');
  await act(async () => release(result('Slow')));
  expect(screen.queryByText('Slow Reference')).toBeNull();
  expect(screen.getByText('Beta Reference')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search payments'), { target: { value: 'Missing' } });
  await screen.findByText('No payments match the current search and filters.');
  expect(screen.getByText('0 payments')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Clear search payments'));
  await screen.findByText('All Reference');
});

test('R3 visible provider and state controls keep search and reset pagination', async () => {
  const router = mount();
  await screen.findByText('Alpha Reference');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Provider' }));
  fireEvent.click(screen.getByRole('option', { name: 'PayPal' }));
  await waitFor(() => expect(router.state.location.search).toContain('provider=PAYPAL'));
  await screen.findByLabelText('Search payments');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'State' }));
  fireEvent.click(screen.getByRole('option', { name: /^Pending$/ }));
  await waitFor(() =>
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/admin/payments?page=1&pageSize=20&provider=PAYPAL&state=PENDING&search=Alpha',
    ),
  );
  await screen.findByText('Alpha Reference');
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await screen.findByText('All Reference');
});
test('R3 search keeps keyboard focus during an in-flight replacement', async () => {
  mount();
  await screen.findByText('Alpha Reference');
  const input = screen.getByLabelText('Search payments');
  input.focus();
  const original = mock.getMockImplementation()!;
  mock.mockImplementation((path, ...rest) =>
    path.includes('search=Typing') ? new Promise(() => {}) : original(path, ...rest),
  );
  fireEvent.change(input, { target: { value: 'Typing' } });
  await waitFor(() => expect(mock).toHaveBeenCalledWith(expect.stringContaining('search=Typing')));
  expect(screen.getByLabelText('Search payments')).toHaveFocus();
  expect(screen.queryByText('Alpha Reference')).toBeNull();
});
