import { describe, expect, test } from 'vitest';
import { assertCreditDatabaseUrl, createRuntimeLogger, runtimeEnvSchema } from './index.js';

describe('runtime foundation', () => {
  test('validates PostgreSQL and Redis configuration', () => {
    expect(
      runtimeEnvSchema.parse({
        DATABASE_URL: 'postgresql://localhost/db',
        REDIS_URL: 'redis://localhost:6380',
      }),
    ).toMatchObject({ NODE_ENV: 'development', LOG_LEVEL: 'info' });
    expect(() =>
      runtimeEnvSchema.parse({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'https://x' }),
    ).toThrow();
  });
  test('creates a service-scoped structured logger', () => {
    const logger = createRuntimeLogger('test-worker', { NODE_ENV: 'test', LOG_LEVEL: 'silent' });
    expect(logger.bindings()).toMatchObject({ service: 'test-worker', environment: 'test' });
  });
  test('rejects unrelated product databases before startup', () => {
    expect(assertCreditDatabaseUrl('postgresql://credit:x@localhost/credit_strategy')).toContain(
      'credit_strategy',
    );
    expect(
      assertCreditDatabaseUrl('postgresql://credit:x@localhost/credit_strategy_test'),
    ).toContain('credit_strategy_test');
    for (const database of ['behfar', 'healix', 'bkos', 'unrelated', 'credit_strategyevil'])
      expect(() => assertCreditDatabaseUrl(`postgresql://user:x@localhost/${database}`)).toThrow(
        'Credit Platform database',
      );
  });
});
