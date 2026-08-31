import type { Logger } from 'pino';

export interface WorkerDependency {
  name: 'postgresql' | 'redis';
  connect(): Promise<void>;
  check(): Promise<void>;
  close(): Promise<void>;
}
export interface WorkerSignalSource {
  once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  off(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}
export async function startWorkerRuntime(options: {
  dependencies: WorkerDependency[];
  logger: Logger;
  signals?: WorkerSignalSource;
}) {
  const { dependencies, logger, signals = process } = options;
  const connected: WorkerDependency[] = [];
  try {
    for (const dependency of dependencies) {
      await dependency.connect();
      connected.push(dependency);
      await dependency.check();
      logger.info({ dependency: dependency.name }, 'Worker dependency ready');
    }
  } catch (error) {
    await Promise.allSettled(connected.reverse().map((dependency) => dependency.close()));
    throw error;
  }
  let stopPromise: Promise<void> | undefined;
  const stop = (signal = 'manual') => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      logger.info({ signal }, 'Worker graceful shutdown started');
      signals.off('SIGINT', onSigint);
      signals.off('SIGTERM', onSigterm);
      await Promise.allSettled([...connected].reverse().map((dependency) => dependency.close()));
      logger.info('Worker stopped');
    })();
    return stopPromise;
  };
  const onSigint = () => void stop('SIGINT');
  const onSigterm = () => void stop('SIGTERM');
  signals.once('SIGINT', onSigint);
  signals.once('SIGTERM', onSigterm);
  logger.info({ dependencies: dependencies.map(({ name }) => name) }, 'Worker ready');
  return { stop };
}
