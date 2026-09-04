import { describe, expect, test } from 'vitest';
import { NOTIFICATION_MAX_ATTEMPTS, notificationRetryDelaySeconds } from './notificationDelivery.js';

describe('notification delivery retry contract', () => {
  test('uses bounded exponential retry and an explicit terminal attempt', () => {
    expect(NOTIFICATION_MAX_ATTEMPTS).toBe(5);
    expect([1, 2, 3, 4, 5].map(notificationRetryDelaySeconds)).toEqual([5, 10, 20, 40, 80]);
    expect(notificationRetryDelaySeconds(20)).toBe(900);
  });
});
