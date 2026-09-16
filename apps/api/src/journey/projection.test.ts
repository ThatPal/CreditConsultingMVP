import { describe, expect, test } from 'vitest';
import {
  appointmentFoundationStatus,
  classifyCycle,
  resolveCurrentFocus,
  summarizePlan,
} from './projection.js';

describe('canonical journey focus', () => {
  test('counts unfinished actions, excluding guidance, milestones and cancelled work', () => {
    const item = {
      id: 'item',
      owner: 'CLIENT',
      completionMode: 'ACKNOWLEDGEMENT',
      title: 'A step',
    };
    const summary = summarizePlan({
      status: 'ACTIVE',
      version: {
        items: [
          { ...item, type: 'ACTION', status: 'COMPLETED' },
          { ...item, type: 'ACTION', status: 'LOCKED' },
          { ...item, type: 'ACTION', status: 'AWAITING_VERIFICATION' },
          { ...item, type: 'ACTION', status: 'CANCELLED' },
          { ...item, type: 'GUIDANCE', status: 'AVAILABLE' },
          { ...item, type: 'MILESTONE', status: 'LOCKED' },
        ],
      },
    });
    expect(summary).toMatchObject({
      openActionCount: 2,
      totalActionCount: 3,
      completedActionCount: 1,
      awaitingVerificationCount: 1,
    });
    expect(summarizePlan(null)).toMatchObject({ status: 'NOT_AVAILABLE', openActionCount: 0 });
  });

  test('a stale strategy overrides the legacy review-sequence action and names the consultant', () => {
    expect(
      resolveCurrentFocus({
        activeNurture: null,
        activeCycle: { id: 'cycle', currentStage: 'APPLICATION_SEQUENCE' },
        hasGoal: true,
        round: { id: 'round', status: 'READY_FOR_STRATEGY', strategy: { status: 'STALE' } },
      }),
    ).toMatchObject({
      code: 'STRATEGY_STALE',
      owner: 'CONSULTANT',
      actionLabel: 'View round status',
    });
  });

  test('blocked rounds precede available Plan actions and stale Plans offer no client work', () => {
    const plan = summarizePlan({
      status: 'STALE',
      version: {
        items: [
          {
            id: 'item',
            type: 'ACTION',
            status: 'AVAILABLE',
            owner: 'CLIENT',
            completionMode: 'ACKNOWLEDGEMENT',
            title: 'Apply',
          },
        ],
      },
    });
    expect(plan.nextClientItem).toBeNull();
    expect(
      resolveCurrentFocus({
        activeNurture: null,
        activeCycle: null,
        hasGoal: true,
        plan,
        round: { id: 'round', status: 'BLOCKED', strategy: null },
      }),
    ).toMatchObject({ code: 'ROUND_BLOCKED', owner: 'CONSULTANT' });
  });
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

  test('projects canonical appointment state instead of reporting available appointments as absent', () => {
    expect(appointmentFoundationStatus('BOOKED')).toBe('BOOKED');
    expect(appointmentFoundationStatus('COMPLETED')).toBe('COMPLETED');
    expect(appointmentFoundationStatus(null)).toBe('NOT_AVAILABLE');
  });
});

test.each(['ACTION', 'GUIDANCE'])('current %s focus opens the exact canonical step', (type) => {
  const plan = summarizePlan({
    status: 'ACTIVE',
    version: {
      items: [
        {
          id: 'step / one',
          title: 'Current step',
          type,
          status: 'AVAILABLE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
        },
      ],
    },
  });
  const focus = resolveCurrentFocus({
    activeCycle: null,
    activeNurture: null,
    hasGoal: true,
    plan,
  });
  const destination = new URL(focus.action, 'https://example.test');
  expect(destination.pathname).toBe('/app/plan');
  expect(destination.searchParams.get('view')).toBe(type === 'ACTION' ? 'actions' : 'guidance');
  expect(destination.searchParams.get('item')).toBe('step / one');
});

test.each(['LIVE', 'PAUSED', 'WAITING_FOR_CLIENT', 'WAITING_FOR_CONSULTANT'])(
  'open session %s takes navigation focus over blocked rounds and old Plan work',
  (status) => {
    const focus = resolveCurrentFocus({
      activeCycle: null,
      activeNurture: null,
      hasGoal: true,
      round: { id: 'round', status: 'BLOCKED', strategy: null },
      liveSession: { id: 'session', roundId: 'round / one', status },
    });
    expect(focus.action).toBe('/app/rounds/round%20%2F%20one/live');
    expect(focus.actionLabel).toBe('Return to session');
    expect(focus.owner).toBe(
      ['PAUSED', 'WAITING_FOR_CONSULTANT'].includes(status) ? 'CONSULTANT' : 'CLIENT',
    );
    expect(focus.detail).not.toMatch(/you can apply|ready to apply/i);
  },
);
test.each(['ENDED', 'SCHEDULED', 'READY'])(
  'session %s does not override a blocking restriction',
  (status) => {
    expect(
      resolveCurrentFocus({
        activeCycle: null,
        activeNurture: null,
        hasGoal: true,
        round: { id: 'round', status: 'BLOCKED', strategy: null },
        liveSession: { id: 'session', roundId: 'round', status },
      }).code,
    ).toBe('ROUND_BLOCKED');
  },
);

test('Major coordination precedes ordinary Plan focus and links to the restriction case', () => {
  const focus = resolveCurrentFocus({
    activeCycle: null,
    activeNurture: null,
    hasGoal: true,
    coordinationRestrictions: [{ caseId: 'case / one', scope: 'SCHEDULING' }],
  });
  expect(focus).toMatchObject({
    code: 'MAJOR_COORDINATION',
    owner: 'CONSULTANT',
    action: '/app/major-readiness/coordination?caseId=case%20%2F%20one',
  });
});
test('Live restrictions retain session navigation while requiring consultant review', () => {
  const focus = resolveCurrentFocus({
    activeCycle: null,
    activeNurture: null,
    hasGoal: true,
    liveSession: { id: 'live', roundId: 'round', status: 'LIVE' },
    coordinationRestrictions: [{ caseId: 'case', scope: 'LIVE_EXECUTION' }],
  });
  expect(focus).toMatchObject({
    code: 'LIVE_RESTRICTED',
    owner: 'CONSULTANT',
    action: '/app/rounds/round/live',
  });
  expect(focus.detail).toContain('Wait for your consultant');
});
test('active Major case replaces only the no-round fallback; completed case is not active work', () => {
  const base = { activeCycle: null, activeNurture: null, hasGoal: true };
  expect(
    resolveCurrentFocus({ ...base, majorCase: { id: 'case', status: 'ASSESSMENT' } }).code,
  ).toBe('MAJOR_READINESS');
  expect(resolveCurrentFocus({ ...base, majorCase: { id: 'case', status: 'COMPLETE' } }).code).toBe(
    'READY_FOR_CYCLE',
  );
});

const scheduledFocusInput = {
  activeCycle: null,
  activeNurture: null,
  hasGoal: true,
  appointment: {
    id: 'appointment',
    roundId: 'round / one',
    status: 'BOOKED',
    startsAt: new Date('2026-09-16T15:00:00Z'),
    endsAt: new Date('2026-09-16T16:00:00Z'),
  },
};
test.each([
  ['2026-09-16T14:29:59.999Z', false],
  ['2026-09-16T14:30:00Z', true],
  ['2026-09-16T15:00:00Z', true],
  ['2026-09-16T15:59:59.999Z', true],
  ['2026-09-16T16:00:00Z', false],
])('scheduled focus boundary %s', (time, expected) => {
  const focus = resolveCurrentFocus({ ...scheduledFocusInput, now: new Date(time) });
  expect(focus.code === 'APPOINTMENT_UPCOMING').toBe(expected);
  if (expected) {
    expect(focus.action).toBe('/app/rounds/round%20%2F%20one/schedule');
    expect(focus.actionLabel).toBe('View appointment');
  }
});
test.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'])('excludes appointment status %s', (status) => {
  expect(
    resolveCurrentFocus({
      ...scheduledFocusInput,
      now: new Date('2026-09-16T15:00:00Z'),
      appointment: { ...scheduledFocusInput.appointment, status },
    }).code,
  ).not.toBe('APPOINTMENT_UPCOMING');
});
test('restriction, blocked Round and open Live session precede booked appointment navigation', () => {
  const input = { ...scheduledFocusInput, now: new Date('2026-09-16T15:00:00Z') };
  expect(
    resolveCurrentFocus({
      ...input,
      coordinationRestrictions: [{ caseId: 'major', scope: 'SCHEDULING' }],
    }).code,
  ).toBe('MAJOR_COORDINATION');
  expect(
    resolveCurrentFocus({ ...input, round: { id: 'round', status: 'BLOCKED', strategy: null } })
      .code,
  ).toBe('ROUND_BLOCKED');
  expect(
    resolveCurrentFocus({ ...input, liveSession: { id: 'live', roundId: 'round', status: 'LIVE' } })
      .code,
  ).toBe('LIVE_RETURN');
});
