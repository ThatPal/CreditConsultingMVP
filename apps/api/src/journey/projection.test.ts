import { describe, expect, test } from 'vitest';
import { classifyCycle, resolveCurrentFocus } from './projection.js';

describe('canonical journey focus', () => {
  test('uses the same deterministic cycle focus for every screen projection', () => {
    const input = {
      activeNurture: null,
      activeCycle: { id: 'cycle-1', currentStage: 'CREDIT_REVIEW' as const },
      hasGoal: true,
    };
    expect(resolveCurrentFocus(input)).toEqual(resolveCurrentFocus(input));
    expect(resolveCurrentFocus(input)).toMatchObject({
      code: 'COMPLETE_REVIEW',
      action: '/app/credit-center/review',
    });
  });

  test('an active nurture period is explicit and takes precedence over cycle inference', () => {
    expect(
      resolveCurrentFocus({
        activeNurture: { reasonCode: 'UTILIZATION_PREPARATION' },
        activeCycle: { id: 'cycle-1', currentStage: 'APPLICATION_ROUND' },
        hasGoal: true,
      }),
    ).toMatchObject({ code: 'NURTURE', title: 'Continue your preparation period' });
  });

  test('distinguishes current and historical cycle groups without inventing future cycles', () => {
    expect(classifyCycle('ACTIVE')).toBe('CURRENT');
    expect(classifyCycle('COMPLETE')).toBe('HISTORY');
    expect(classifyCycle('CANCELLED')).toBe('HISTORY');
  });

  test('falls back to factual goal onboarding states', () => {
    expect(
      resolveCurrentFocus({ activeNurture: null, activeCycle: null, hasGoal: false }),
    ).toMatchObject({ code: 'SET_GOAL' });
    expect(
      resolveCurrentFocus({ activeNurture: null, activeCycle: null, hasGoal: true }),
    ).toMatchObject({ code: 'READY_FOR_CYCLE' });
  });
});
