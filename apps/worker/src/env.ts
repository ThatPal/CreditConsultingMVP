import { resolve } from 'node:path';
import { config } from 'dotenv';
import { assertCreditDatabaseUrl, runtimeEnvSchema } from '@credit/runtime';
config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});
export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;
export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = runtimeEnvSchema.parse(source);
  assertCreditDatabaseUrl(parsed.DATABASE_URL);
  const emailProvider = source.EMAIL_PROVIDER ?? 'CONSOLE';
  if (!['CONSOLE', 'SMTP', 'EXTERNAL'].includes(emailProvider))
    throw new Error('Invalid EMAIL_PROVIDER');
  return {
    ...parsed,
    EMAIL_PROVIDER: emailProvider as 'CONSOLE' | 'SMTP' | 'EXTERNAL',
    EMAIL_FROM: source.EMAIL_FROM ?? 'no-reply@example.invalid',
  };
}
