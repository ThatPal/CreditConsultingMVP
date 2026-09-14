import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, Route, RouterProvider, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { NavigationProtection, useNavigationProtection } from './NavigationProtection';
import { PlanResponse } from './features/plans/PlanResponse';

function setup(content: React.ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationProtection>
            <Routes>
              <Route
                path="/plan"
                element={
                  <>
                    {content}
                    <Link to="/home">Home</Link>
                  </>
                }
              />
              <Route path="/home" element={<h1>Home destination</h1>} />
            </Routes>
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/home', '/plan'], initialIndex: 1 },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
function response(save: () => Promise<void>) {
  return (
    <PlanResponse
      item={{ id: 'test', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }}
      onSaveDraft={save}
    />
  );
}
const edit = () =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Keep my answer' },
  });

test('retains edits on cancelled navigation and proceeds only after pending autosave finishes', async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const router = setup(response(save));
  edit();
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(router.state.location.pathname).toBe('/plan');
  fireEvent.click(screen.getByRole('button', { name: 'Stay on this page' }));
  expect(await screen.findByRole('textbox')).toHaveValue('Keep my answer');
  await waitFor(() => expect(save).toHaveBeenCalledOnce(), { timeout: 3000 });
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(screen.getByRole('button', { name: 'Leave without latest changes' })).toBeDisabled();
  await act(async () => finish());
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to page' }));
  expect(await screen.findByRole('heading', { name: 'Home destination' })).toBeVisible();
});

test('Back navigation after a failed save needs an explicit discard decision', async () => {
  const router = setup(
    response(async () => {
      throw new Error('Could not save');
    }),
  );
  edit();
  await screen.findByText('Could not save', {}, { timeout: 3000 });
  await act(async () => {
    await router.navigate(-1);
  });
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(router.state.location.pathname).toBe('/plan');
  fireEvent.click(screen.getByRole('button', { name: 'Leave without latest changes' }));
  expect(await screen.findByRole('heading', { name: 'Home destination' })).toBeVisible();
});

test('clean responses navigate without a confirmation', async () => {
  setup(response(async () => {}));
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(await screen.findByRole('heading', { name: 'Home destination' })).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

function Work({ busy = false }: { busy?: boolean }) {
  useNavigationProtection(true, busy);
  return null;
}
function Multiple() {
  const [show, setShow] = useState(true);
  return (
    <>
      {show && <Work />}
      <Work busy />
      <button onClick={() => setShow(false)}>Remove first response</button>
    </>
  );
}
test('removing one response does not clear another response upload protection', async () => {
  setup(<Multiple />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove first response' }));
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Leave without latest changes' })).toBeDisabled();
});

