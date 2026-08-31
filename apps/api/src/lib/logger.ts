import { createRuntimeLogger } from '@credit/runtime';
import type { AppEnv } from '../config/env.js';

export function createLogger(env: Pick<AppEnv, 'LOG_LEVEL' | 'NODE_ENV'>) {
  return createRuntimeLogger('credit-api', env);
}
