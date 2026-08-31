import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';
import { loadEnv } from '../config/env.js';
import { createEmailProvider } from './emailProvider.js';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://credit:credit_dev@localhost:5433/credit_strategy_test?schema=public',
  REDIS_URL: 'redis://localhost:6380',
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
};

describe('canonical email providers', () => {
  test('passes generic and Google Workspace relay-compatible SMTP configuration to an injected transport', async () => {
    const send = vi.fn(async () => ({ accepted: true, providerMessageId: 'smtp-1' }));
    const testConnection = vi.fn(async () => undefined);
    const provider = createEmailProvider(
      loadEnv({
        ...base,
        EMAIL_PROVIDER: 'SMTP',
        EMAIL_FROM: 'mail@example.test',
        EMAIL_SMTP_HOST: 'smtp-relay.gmail.com',
        EMAIL_SMTP_PORT: '587',
        EMAIL_SMTP_SECURE: 'true',
        EMAIL_SMTP_USERNAME: 'relay-user',
        EMAIL_SMTP_PASSWORD_SECRET_REF: 'secret://email/google-workspace-relay',
      }),
      pino({ enabled: false }),
      { smtp: { send, testConnection } },
    );
    await provider.send({ to: 'client@example.test', subject: 'Safe subject', text: 'Safe body' });
    await provider.testConnection?.();
    expect(send.mock.calls[0]?.[0]).toEqual({
      host: 'smtp-relay.gmail.com',
      port: 587,
      secure: true,
      username: 'relay-user',
      passwordSecretRef: 'secret://email/google-workspace-relay',
      from: 'mail@example.test',
    });
    expect(testConnection).toHaveBeenCalledOnce();
  });

  test('fails closed when configured production delivery adapters are unavailable', () => {
    expect(() =>
      createEmailProvider(
        loadEnv({
          ...base,
          NODE_ENV: 'production',
          EMAIL_PROVIDER: 'EXTERNAL',
          EMAIL_FROM: 'mail@example.test',
        }),
        pino({ enabled: false }),
      ),
    ).toThrow('no adapter is installed');
  });

  test('console capture logs metadata but not sensitive message content', async () => {
    const logger = pino({ enabled: false });
    const info = vi.spyOn(logger, 'info');
    const provider = createEmailProvider(loadEnv({ ...base, EMAIL_PROVIDER: 'CONSOLE' }), logger);
    await provider.send({
      to: 'client@example.test',
      subject: 'Reset password',
      text: 'https://example.test/reset?token=secret-token',
      sensitive: true,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-token');
  });
});
