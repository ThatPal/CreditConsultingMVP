import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { PlanResponsePreview, PlanResponsePreviewProvider } from './PlanResponsePreview';
import type { PlanItem } from './editor';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
test('batches client fields and displays required constraints without enabling submission', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    items: [
      {
        stableKey: 'one',
        fields: [
          {
            key: 'amount',
            label: 'Current balance',
            type: 'number',
            required: true,
            minimum: 0,
            maximum: 500,
          },
        ],
        error: null,
      },
      { stableKey: 'two', fields: [], error: 'Configure this form' },
    ],
  });
  const items = ['one', 'two'].map(
    (stableKey) =>
      ({ stableKey, owner: 'CLIENT', completionMode: 'STRUCTURED_OUTCOME' }) as PlanItem,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlanResponsePreviewProvider clientId="client" items={items} enabled>
        {items.map((item) => (
          <PlanResponsePreview key={item.stableKey} item={item} />
        ))}
      </PlanResponsePreviewProvider>
    </QueryClientProvider>,
  );
  const input = await screen.findByRole('spinbutton', { name: 'Current balance' });
  expect(input).toBeDisabled();
  expect(input).toBeRequired();
  expect(screen.getByText(/Maximum: 500/)).toBeInTheDocument();
  expect(screen.getByText('Configure this form')).toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
});
