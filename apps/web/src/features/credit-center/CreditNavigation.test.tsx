import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import {
  CreditCenterNavigation,
  CreditCenterDestinations,
  creditCenterAreas,
} from './CreditCenterNavigation';
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
test('mobile hub offers all destinations without the six-peer strip', () => {
  media.wide = false;
  show(
    <>
      <CreditCenterNavigation area="overview" />
      <CreditCenterDestinations />
    </>,
  );
  expect(
    screen.queryByRole('navigation', { name: 'Credit Center sections' }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(5);
});
test.each(['profile', 'report', 'analysis', 'plan', 'history'] as const)(
  'mobile direct %s entry always has explicit hub return',
  (area) => {
    media.wide = false;
    show(<CreditCenterNavigation area={area} />);
    expect(screen.getByRole('link', { name: 'Credit Center' })).toHaveAttribute(
      'href',
      '/app/credit-center',
    );
    expect(
      screen.queryByRole('navigation', { name: 'Credit Center sections' }),
    ).not.toBeInTheDocument();
  },
);
