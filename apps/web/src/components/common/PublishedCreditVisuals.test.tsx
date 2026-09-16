import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PublishedScoreGauge, PublishedUtilizationRing } from './PublishedCreditVisuals';

test('score position is explicit about the reference range and does not assign a rating', () => {
  const { container } = render(<PublishedScoreGauge value={575} bureau="Experian" />);
  expect(screen.getByRole('img')).toHaveAccessibleName(
    /Experian score 575.*reference scale.*model not supplied/,
  );
  expect(Number(container.querySelector('circle')?.getAttribute('cx'))).toBeCloseTo(110);
  expect(screen.queryByText(/excellent|poor|good/i)).not.toBeInTheDocument();
});
test('missing and outside-range scores have no fabricated position', () => {
  const { container, rerender } = render(<PublishedScoreGauge value={null} bureau="Equifax" />);
  expect(screen.getByRole('img')).toHaveAccessibleName('Equifax: not reported');
  expect(container.querySelector('circle')).toBeNull();
  rerender(<PublishedScoreGauge value={900} bureau="Equifax" />);
  expect(screen.getByText('900')).toBeInTheDocument();
  expect(container.querySelector('circle')).toBeNull();
});
test('utilization preserves an over-limit value while capping the graphic', () => {
  render(<PublishedUtilizationRing value={120} />);
  expect(screen.getByRole('img')).toHaveAccessibleName(
    'Credit utilization 120 percent; ring capped at 100 percent',
  );
  expect(screen.getByText('120%')).toBeInTheDocument();
});
