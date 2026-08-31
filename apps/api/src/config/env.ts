import { resolve } from 'node:path';
import { assertCreditDatabaseUrl, runtimeEnvSchema } from '@credit/runtime';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const schema = runtimeEnvSchema
  .extend({
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('credit_sid'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
    PASSWORD_RESET_BASE_URL: z.url().default('http://localhost:5173/reset-password'),
    BETTER_AUTH_URL: z.url().default('http://localhost:3001'),
    BETTER_AUTH_SECRET: z.string().min(32).default('development-only-better-auth-secret-change-me'),
    AUTH_RATE_LIMIT_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(5),
    MFA_STEP_UP_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
    EMAIL_PROVIDER: z.enum(['CONSOLE', 'SMTP', 'EXTERNAL']).default('CONSOLE'),
    EMAIL_FROM: z.email().default('no-reply@example.invalid'),
    EMAIL_SMTP_HOST: z.string().min(1).optional(),
    EMAIL_SMTP_PORT: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.EMAIL_PROVIDER === 'CONSOLE')
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'Production requires a configured outbound email provider',
      });
    if (value.EMAIL_PROVIDER === 'SMTP' && (!value.EMAIL_SMTP_HOST || !value.EMAIL_SMTP_PORT))
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_SMTP_HOST'],
        message: 'SMTP email requires EMAIL_SMTP_HOST and EMAIL_SMTP_PORT',
      });
  });

export type AppEnv = z.infer<typeof schema>;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = schema.parse(source);
  assertCreditDatabaseUrl(parsed.DATABASE_URL);
  return parsed;
}
