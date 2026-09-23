import { safeReturnPath } from '../auth/safeReturnPath';

const storageKey = 'credit.goal-intake-token';
let memoryToken = '';
export function savedIntakeToken() {
  try {
    return sessionStorage.getItem(storageKey) || memoryToken;
  } catch {
    return memoryToken;
  }
}
export function rememberIntake(token: string) {
  memoryToken = token;
  try {
    sessionStorage.setItem(storageKey, token);
  } catch {
    /* Same-page links retain the capability. */
  }
}
export function forgetIntake() {
  memoryToken = '';
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage is best effort. */
  }
}
export function entryLink(path: string, params: URLSearchParams) {
  const url = new URL(path, 'https://entry.invalid');
  const intake = params.get('intake');
  if (intake && /^[A-Za-z0-9_-]{43}$/.test(intake)) url.searchParams.set('intake', intake);
  const returnTo = params.get('returnTo');
  if (returnTo) url.searchParams.set('returnTo', safeReturnPath(returnTo, '/app'));
  return url.pathname + url.search;
}
export function entryDestination(params: URLSearchParams, role: string, fallback: string) {
  if (role !== 'CLIENT') {
    const home = role === 'ADMIN' ? '/admin' : '/crm';
    const safe = safeReturnPath(fallback, home);
    const path = new URL(safe, 'https://entry.invalid').pathname;
    return path === home ||
      path.startsWith(home + '/') ||
      (role === 'CONSULTANT' && path.startsWith('/consultant/'))
      ? safe
      : home;
  }
  return params.has('intake')
    ? entryLink('/app/goals', params)
    : entryClientReturn(params.get('returnTo') ?? fallback);
}
export function entryClientReturn(value: unknown) {
  const safe = safeReturnPath(value, '/app');
  const url = new URL(safe, 'https://entry.invalid');
  if (
    url.pathname !== '/app' &&
    !url.pathname.startsWith('/app/') &&
    !url.pathname.startsWith('/client/')
  )
    return '/app';
  url.searchParams.delete('intake');
  url.searchParams.delete('intakeClaim');
  url.searchParams.delete('returnTo');
  return url.pathname + url.search + url.hash;
}

export function entryCallback(path: string, params: URLSearchParams) {
  return new URL(entryLink(path, params), window.location.origin).href;
}
