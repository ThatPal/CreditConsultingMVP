import { expect, test, vi } from 'vitest';
import { createLiveSessionGuard } from './liveSessionGuard.js';
import type { AuthPrincipal } from './types.js';
const original: AuthPrincipal = {
  userId: 'u',
  sessionId: 's',
  email: 'synthetic@example.test',
  clientId: 'c',
  role: 'CLIENT',
  status: 'ACTIVE',
};
test.each([
  null,
  { ...original, sessionId: 'new' },
  { ...original, userId: 'other' },
  { ...original, status: 'DISABLED' as const },
  { ...original, clientId: 'other' },
])('invalid session ends the stream: %j', async (current) => {
  const ended = vi.fn(),
    unavailable = vi.fn();
  const guard = createLiveSessionGuard(original, async () => current, ended, unavailable);
  expect(await guard.check()).toBe(false);
  expect(await guard.check()).toBe(false);
  expect(ended).toHaveBeenCalledOnce();
  expect(unavailable).not.toHaveBeenCalled();
});
test('lookup failure closes for retry without announcing expiry', async () => {
  const ended = vi.fn(),
    unavailable = vi.fn();
  const guard = createLiveSessionGuard(
    original,
    async () => {
      throw new Error('Database unavailable');
    },
    ended,
    unavailable,
  );
  expect(await guard.check()).toBe(false);
  expect(unavailable).toHaveBeenCalledOnce();
  expect(ended).not.toHaveBeenCalled();
});
test('concurrent checks share one lookup and disconnect ignores its late result', async () => {
  let finish!: (value: AuthPrincipal | null) => void;
  const resolve = vi.fn(
    () =>
      new Promise<AuthPrincipal | null>((r) => {
        finish = r;
      }),
  );
  const ended = vi.fn();
  const guard = createLiveSessionGuard(original, resolve, ended, vi.fn());
  const first = guard.check(),
    second = guard.check();
  expect(resolve).toHaveBeenCalledOnce();
  guard.stop();
  finish(null);
  expect(await first).toBe(false);
  expect(await second).toBe(false);
  expect(ended).not.toHaveBeenCalled();
});
test('a valid session continues, while lost staff MFA closes', async () => {
  expect(
    await createLiveSessionGuard(original, async () => original, vi.fn(), vi.fn()).check(),
  ).toBe(true);
  const staff = { ...original, role: 'ADMIN' as const, staffMfaVerified: true };
  const ended = vi.fn();
  expect(
    await createLiveSessionGuard(
      staff,
      async () => ({ ...staff, staffMfaVerified: false }),
      ended,
      vi.fn(),
    ).check(),
  ).toBe(false);
  expect(ended).toHaveBeenCalledOnce();
});
