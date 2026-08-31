import { resolve } from 'node:path';
import { config } from 'dotenv';
import { runtimeEnvSchema } from '@credit/runtime';
config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});
export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;
export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env) {
  return runtimeEnvSchema.parse(source);
}
