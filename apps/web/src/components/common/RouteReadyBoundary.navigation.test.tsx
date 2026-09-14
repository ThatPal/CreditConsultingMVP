import { act, fireEvent, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { RouteReadyBoundary } from './RouteReadyBoundary';

afterEach(() => vi.useRealTimers());

test('a slow family keeps an announced loading state and a working home escape', async () => {
  vi.useFakeTimers();
  const Waiting = lazy(() => new Promise<{ default: () => React.ReactNode }>(() => {}));
  render(
    <MemoryRouter initialEntries={['/app/plan']}>
      <RouteReadyBoundary>
        <Routes>
          <Route path="/app/plan" element={<Waiting />} />
          <Route path="/app" element={<h1>Portal home loaded</h1>} />
        </Routes>
      </RouteReadyBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading client portal page');
  expect(screen.queryByRole('link', { name: 'Return to portal home' })).not.toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(8000);
  });
  expect(screen.getByRole('status')).toHaveTextContent('taking longer than expected');
  fireEvent.click(screen.getByRole('link', { name: 'Return to portal home' }));
  expect(screen.getByRole('heading', { name: 'Portal home loaded' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('a rejected family recovers when navigating home without reloading the shell', async () => {
  const Broken = lazy(() => Promise.reject(new Error('synthetic unavailable page')));
  const report = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(
      <MemoryRouter initialEntries={['/app/plan']}>
        <nav>Persistent portal navigation</nav>
        <RouteReadyBoundary>
          <Routes>
            <Route path="/app/plan" element={<Broken />} />
            <Route path="/app" element={<h1>Portal home loaded</h1>} />
          </Routes>
        </RouteReadyBoundary>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Reloading clears unsaved changes');
    expect(screen.getByRole('navigation')).toHaveTextContent('Persistent portal navigation');
    fireEvent.click(screen.getByRole('link', { name: 'Return to portal home' }));
    expect(screen.getByRole('heading', { name: 'Portal home loaded' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally {
    report.mockRestore();
  }
});
