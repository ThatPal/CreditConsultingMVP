import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('credit_sid'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
    PASSWORD_RESET_BASE_URL: z.url().default('http://localhost:5173/reset-password'),
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
  return schema.parse(source);
}
