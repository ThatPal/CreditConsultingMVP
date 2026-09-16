import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { PlanDecisions } from './PlanContextViews';
test('published decisions retain their source and historical qualification', () => {
  render(
    <MemoryRouter>
      <PlanDecisions
        decisions={[
          {
            id: 'd',
            title: 'Review recommendation',
            explanation: 'Published instruction',
            publishedAt: '2026-01-01',
            historical: true,
            href: '/app/credit-center/history',
            sourceLabel: 'Published review',
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Saved publication/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View source context' })).toHaveAttribute(
    'href',
    '/app/credit-center/history',
  );
  expect(screen.getByText('Published instruction')).toBeInTheDocument();
});
test('no published decision context does not invent a recommendation', () => {
  render(<PlanDecisions decisions={[]} />);
  expect(
    screen.getByText(/No published recommendations or coordination decisions/),
  ).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
