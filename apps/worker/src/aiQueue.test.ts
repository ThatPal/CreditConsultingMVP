import { describe, expect, test } from 'vitest';
import { AI_QUEUE, aiJobOptions } from './aiQueue.js';

describe('AI queue contract', () => {
  test('uses an isolated durable queue with bounded transient retries', () => {
    expect(AI_QUEUE).toBe('credit-ai-v1');
    expect(aiJobOptions.attempts).toBe(3);
    expect(aiJobOptions.backoff).toEqual({ type: 'exponential', delay: 2_000 });
  });
});
