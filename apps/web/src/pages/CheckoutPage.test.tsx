import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { CheckoutPage } from './CheckoutPage';

afterEach(() => vi.restoreAllMocks());

test('PORTAL-24 launches BofA through a server-signed hosted form without card fields', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.method === 'POST')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            action: 'https://testsecureacceptance.cybersource.com/pay',
            method: 'POST',
            fields: {
              amount: '43.00',
              currency: 'USD',
              transaction_uuid: 'payment-bofa',
              signature: 'signed-not-secret',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    return Promise.resolve(
      new Response(
        JSON.stringify({
          purchase: {
            id: 'purchase-bofa',
            status: 'PENDING',
            terms: { name: 'BofA hosted service', amount: '43.00', currency: 'USD' },
            effectsGranted: false,
          },
          payment: {
            provider: 'BOFA_MERCHANT',
            environment: 'SANDBOX',
            state: 'AWAITING_CUSTOMER',
            checkoutUrl: 'https://testsecureacceptance.cybersource.com/pay',
            lastErrorCode: null,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  });
  let submittedAction = '';
  let submittedFields: Record<string, string> = {};
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
    this: HTMLFormElement,
  ) {
    submittedAction = this.action;
    submittedFields = Object.fromEntries(
      [...this.querySelectorAll<HTMLInputElement>('input')].map((input) => [
        input.name,
        input.value,
      ]),
    );
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/app/checkout/purchase-bofa']}>
          <Routes>
            <Route path="/app/checkout/:purchaseIntentId" element={<CheckoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: /continue with bank of america merchant services/i,
    }),
  );
  await waitFor(() =>
    expect(submittedAction).toBe('https://testsecureacceptance.cybersource.com/pay'),
  );
  expect(submittedFields).toMatchObject({
    amount: '43.00',
    currency: 'USD',
    transaction_uuid: 'payment-bofa',
    signature: 'signed-not-secret',
  });
  expect(submittedFields).not.toHaveProperty('card_number');
  expect(submittedFields).not.toHaveProperty('card_cvn');
});
