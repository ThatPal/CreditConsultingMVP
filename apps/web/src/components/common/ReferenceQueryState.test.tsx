import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { ReferenceQueryState } from './ReferenceQueryState';
test('loading retains the page name and announced state', () => {
  render(<ReferenceQueryState title="Credit Center" loading />);
  expect(screen.getByRole('heading', { level: 1, name: 'Credit Center' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading Credit Center');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('failure retains context and offers a keyboard-native retry button', () => {
  const retry = vi.fn();
  render(
    <MemoryRouter>
      <ReferenceQueryState
        title="Your Credit Plan"
        error={new Error('internal diagnostic')}
        onRetry={retry}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Your Credit Plan' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('internal diagnostic')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
});
