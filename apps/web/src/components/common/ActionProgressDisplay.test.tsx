import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ActionProgressDisplay } from './ActionProgressDisplay';

test.each([0, 37, 100])('shows the supplied server percentage %s', (percent) => {
  render(<ActionProgressDisplay percent={percent} />);
  expect(screen.getByRole('img')).toHaveAccessibleName(
    `Action progress: ${percent} percent complete`,
  );
  expect(screen.getByText(`${percent}%`)).toBeInTheDocument();
});
test.each([null, undefined, NaN, Infinity, -1, 101])(
  'does not turn unavailable or invalid progress into a completed ratio: %s',
  (percent) => {
    render(<ActionProgressDisplay percent={percent} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  },
);
