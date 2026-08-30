import pino from 'pino';
import type { AppEnv } from '../config/env.js';

export function createLogger(env: Pick<AppEnv, 'LOG_LEVEL' | 'NODE_ENV'>) {
  return pino({
    level: env.LOG_LEVEL,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
    ],
    base: { service: 'credit-api', environment: env.NODE_ENV },
  });
}
