import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { ClientPortalNavigation } from './ClientPortalNavigation';
import { navigationFor } from './navigation';
import { theme } from '../theme';
import type { CurrentUser } from '../auth/api';
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
const items = navigationFor({ role: 'CLIENT' } as CurrentUser, 'client');
const show = (desktop: boolean, path = '/app/credit-center/analysis') =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <ClientPortalNavigation items={items} desktop={desktop} />
      </MemoryRouter>
    </ThemeProvider>,
  );
test('desktop primary navigation is ordered, More expanded, reassurance is not a link', () => {
  show(true);
  expect(
    screen
      .getAllByRole('link')
      .slice(0, 6)
      .map((e) => e.textContent),
  ).toEqual(['Home', 'Journey', 'Credit Center', 'Cards', 'Services', 'Support']);
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: 'Credit Center' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'href',
    '/app/account/security',
  );
  expect(screen.queryByRole('link', { name: /Secure workspace/ })).not.toBeInTheDocument();
});
test.each([
  '/app/credit-center',
  '/app/credit-center/profile',
  '/app/credit-center/report',
  '/app/credit-center/analysis',
  '/app/credit-center/plan',
  '/app/credit-center/history',
  '/app/plan',
])('mobile parent stays selected on %s', (path) => {
  show(false, path);
  expect(screen.getByRole('link', { name: 'Credit Center' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getAllByRole('link')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
});
test('mobile More has seven ordered destinations/actions and dismisses', async () => {
  show(false);
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const dialog = screen.getByRole('dialog', { name: 'More' });
  expect(
    within(dialog)
      .getAllByRole('link')
      .map((e) => e.textContent),
  ).toEqual(['Services', 'Support', 'Documents', 'Notifications', 'Account', 'Settings']);
  expect(within(dialog).getByRole('button', { name: 'Sign Out' })).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close More' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test.each([
  ['/app', 'Home'],
  ['/app/journey', 'Journey'],
  ['/app/credit-center', 'Credit Center'],
  ['/app/cards', 'Cards'],
  ['/app/services', 'Services'],
  ['/app/support', 'Support'],
])('desktop active parent follows %s', (path, label) => {
  show(true, path);
  expect(screen.getByRole('link', { name: label })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
