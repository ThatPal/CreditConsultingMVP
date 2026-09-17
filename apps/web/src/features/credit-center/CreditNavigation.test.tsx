import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import { CreditCenterNavigation, creditCenterAreas } from './CreditCenterNavigation';
const media = vi.hoisted(() => ({ wide: true }));
vi.mock('@mui/material', async (original) => ({
  ...(await original<typeof import('@mui/material')>()),
  useMediaQuery: () => media.wide,
}));
beforeEach(() => {
  media.wide = true;
});
const show = (node: React.ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </ThemeProvider>,
  );
test.each(creditCenterAreas)('wide $title has one selected peer among six', ({ id, title }) => {
  show(<CreditCenterNavigation area={id} />);
  expect(screen.getAllByRole('link')).toHaveLength(6);
  expect(screen.getByRole('link', { name: title })).toHaveAttribute('aria-current', 'page');
  expect(
    screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page'),
  ).toHaveLength(1);
});
test.each(creditCenterAreas)(
  'mobile $title retains its selector and six ordered areas',
  async ({ id, title }) => {
    media.wide = false;
    show(<CreditCenterNavigation area={id} />);
    const trigger = screen.getByRole('button', { name: 'Credit Center section: ' + title });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Credit Center sections' });
    const links = within(dialog).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/app/credit-center',
      '/app/credit-center/profile',
      '/app/credit-center/report',
      '/app/credit-center/analysis',
      '/app/credit-center/plan',
      '/app/credit-center/history',
    ]);
    expect(links.find((a) => a.getAttribute('aria-current') === 'page')).toHaveTextContent(title);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
);

test('area navigation preserves an explicit Review context', () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/app/credit-center/profile?review=older']}>
        <CreditCenterNavigation area="profile" />
      </MemoryRouter>
    </ThemeProvider>,
  );
  for (const link of screen.getAllByRole('link'))
    expect(link.getAttribute('href')).toContain('?review=older');
});
