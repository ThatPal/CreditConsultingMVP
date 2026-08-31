import { EventEmitter } from 'node:events';
import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';
import { startWorkerRuntime, type WorkerDependency } from './runtime.js';

function dependency(name: WorkerDependency['name']): WorkerDependency {
  return {
    name,
    connect: vi.fn(async () => undefined),
    check: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}
describe('worker runtime', () => {
  test('checks dependencies and shuts them down once on a signal', async () => {
    const signals = new EventEmitter();
    const postgresql = dependency('postgresql');
    const redis = dependency('redis');
    const runtime = await startWorkerRuntime({
      dependencies: [postgresql, redis],
      logger: pino({ level: 'silent' }),
      signals,
    });
    expect(postgresql.connect).toHaveBeenCalledOnce();
    expect(redis.check).toHaveBeenCalledOnce();
    signals.emit('SIGTERM');
    await runtime.stop();
    expect(postgresql.close).toHaveBeenCalledOnce();
    expect(redis.close).toHaveBeenCalledOnce();
  });
  test('fails startup when required infrastructure is unavailable', async () => {
    const unavailable = dependency('redis');
    vi.mocked(unavailable.check).mockRejectedValueOnce(new Error('unavailable'));
    await expect(
      startWorkerRuntime({
        dependencies: [unavailable],
        logger: pino({ level: 'silent' }),
        signals: new EventEmitter(),
      }),
    ).rejects.toThrow('unavailable');
    expect(unavailable.close).toHaveBeenCalledOnce();
  });
});
