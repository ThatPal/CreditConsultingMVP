import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { lazy } from 'react';
import { RouteReadyBoundary, routeReadyCopy } from './RouteReadyBoundary';

function BrokenRoute(): never { throw new Error('synthetic route failure'); }
const BrokenLazyRoute = lazy(() => Promise.reject(new Error('synthetic family chunk failure')));

describe('authenticated route readiness', () => {
  test('preserves role-specific location copy', () => {
    expect(routeReadyCopy('/app/cards/wishlist')).toMatchObject({ label: 'client portal page', home: '/app' });
    expect(routeReadyCopy('/crm/support')).toMatchObject({ label: 'CRM workspace', home: '/crm' });
    expect(routeReadyCopy('/admin/payments')).toMatchObject({ label: 'Admin workspace', home: '/admin' });
  });

  test('renders purposeful recovery instead of a blank document after a route failure', () => {
    render(<MemoryRouter initialEntries={['/app/cards/wishlist']}><RouteReadyBoundary><BrokenRoute /></RouteReadyBoundary></MemoryRouter>);
    expect(screen.getByText(/client portal page couldn’t be loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/No submitted or saved state was changed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to portal home/i })).toHaveAttribute('href', '/app');
  });

  test('keeps the D0 recovery contract when a lazy route family fails to load', async () => {
    render(<MemoryRouter initialEntries={['/admin/reports']}><RouteReadyBoundary><BrokenLazyRoute /></RouteReadyBoundary></MemoryRouter>);
    expect(await screen.findByText(/Admin workspace couldn’t be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to Admin home/i })).toHaveAttribute('href', '/admin');
  });
});
