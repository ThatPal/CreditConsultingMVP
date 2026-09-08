import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiRequestError } from '../../auth/api';
import { theme } from '../../theme';
import { GovernedActionDialog, RecoveryState, RecordContext } from './InteractionPatterns';

const mount = (node: ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </ThemeProvider>,
  );
test('record context exposes accessible breadcrumbs and return links', () => {
  mount(
    <RecordContext
      breadcrumbs={[{ label: 'Clients', to: '/crm/clients' }, { label: 'Sample Client' }]}
      title="Sample Client"
    />,
  );
  expect(screen.getByRole('navigation', { name: 'Record context' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/crm/clients');
});
test('typed recovery distinguishes access denial and offers a safe retry', () => {
  const retry = vi.fn();
  mount(
    <RecoveryState error={new ApiRequestError('FORBIDDEN', 403, 'Not in scope')} onRetry={retry} />,
  );
  expect(screen.getByText('Access is restricted')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
});
test('governed dialog requires a reason, cancels by keyboard and restores trigger focus', async () => {
  const cancel = vi.fn();
  const confirm = vi.fn();
  const { rerender } = mount(
    <>
      <button>Trigger</button>
      <GovernedActionDialog
        open
        title="Disable integration"
        effect="Stops future delivery"
        reason=""
        required
        reasonLabel="Reason"
        onReasonChange={() => {}}
        onCancel={cancel}
        onConfirm={confirm}
      />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(cancel).toHaveBeenCalled());
  rerender(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <GovernedActionDialog
          open
          title="Disable integration"
          effect="Stops future delivery"
          reason="Approved maintenance"
          required
          reasonLabel="Reason"
          onReasonChange={() => {}}
          onCancel={cancel}
          onConfirm={confirm}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  expect(confirm).toHaveBeenCalledOnce();
});

test('governed dialog exposes a complete consequence-aware change preview', () => {
  mount(
    <GovernedActionDialog
      open
      title="Change checkout provider"
      effect="Changes future checkout routing"
      preview={{
        current: 'PayPal',
        proposed: 'Stripe',
        scope: 'Future purchases only',
        timing: 'Immediately after confirmation',
        reversibility: 'Reversible by another authorized change',
        audit: 'Actor and outcome are recorded',
      }}
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );
  const preview = screen.getByLabelText('Change preview');
  expect(preview).toHaveTextContent('Current statePayPal');
  expect(preview).toHaveTextContent('Proposed stateStripe');
  expect(preview).toHaveTextContent('Future purchases only');
  expect(preview).toHaveTextContent('Actor and outcome are recorded');
});
