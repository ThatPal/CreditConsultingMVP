import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { theme } from '../theme';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  StaffMfaPage,
} from './AuthPages';

const authState = vi.hoisted(() => ({ user: null, refresh: vi.fn(async () => undefined) }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => authState }));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(element: ReactNode, entry: string | { pathname: string; state?: unknown }) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function response(body: unknown = {}, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  authState.refresh.mockClear();
});

describe('client authentication pages', () => {
  test('staff two-factor challenge has accessible retry and recovery states', async () => {
    authState.user = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      response({ message: 'Code expired' }, 400),
    );
    renderPage(<StaffMfaPage />, '/mfa?mode=challenge&returnTo=%2Fconsultant%2Fdashboard');
    expect(screen.getByRole('heading', { name: /verify it.s you/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/six-digit code/i), { target: { value: '123456' } });
    fireEvent.submit(screen.getByRole('button', { name: /verify and continue/i }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/retry or contact support/i);
  });

  test('registration submits required profile and terms fields then shows verification handoff', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => response({ user: {} }));
    renderPage(<RegisterPage />, '/register');
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'Correct-Horse-Battery-21!' },
    });
    const terms = screen.getByRole('checkbox', { name: /accept the terms/i });
    expect(terms).toBeRequired();
    fireEvent.click(terms);
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    expect(await screen.findByText(/check your email to verify/i)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      authFirstName: 'Ada',
      authLastName: 'Lovelace',
      authTermsAccepted: true,
    });
  });

  test('login shows loading and follows only the safe internal return path', async () => {
    let completeSignIn!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => (completeSignIn = resolve));
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => pending)
      .mockImplementationOnce(() =>
        response({ user: { role: 'CLIENT', status: 'ACTIVE', userId: 'u', clientId: 'c' } }),
      );
    renderPage(<LoginPage />, { pathname: '/login', state: { from: '/client/goals?tab=next' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'client@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'valid-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    completeSignIn(new Response('{}', { status: 200 }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/client/goals?tab=next'),
    );
  });

  test('login exposes the verification recovery action', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => response({ message: 'Email is not verified' }, 403))
      .mockImplementationOnce(() => response({ status: true }));
    renderPage(<LoginPage />, '/login');
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'client@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'wrong-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(await screen.findByText('Email is not verified')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resend verification/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  test('forgot password always presents the generic handoff', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => response({ status: true }));
    renderPage(<ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'unknown@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form')!);
    expect(await screen.findByText(/check your email for reset instructions/i)).toBeInTheDocument();
  });

  test('reset requires a token and offers recovery for invalid or expired links', async () => {
    const { unmount } = renderPage(<ResetPasswordPage />, '/reset-password');
    expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    unmount();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      response({ message: 'Reset token is invalid or expired' }, 400),
    );
    renderPage(<ResetPasswordPage />, '/reset-password?token=invalid');
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'A-New-Correct-Horse-Password-21!' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form')!);
    expect(await screen.findByText(/reset token is invalid or expired/i)).toBeInTheDocument();
  });

  test('successful reset sends the token and hands off to sign in', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => response({ status: true }));
    renderPage(<ResetPasswordPage />, '/reset-password?token=good-token');
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'A-New-Correct-Horse-Password-21!' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form')!);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?reset=1'));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      token: 'good-token',
    });
  });
});
