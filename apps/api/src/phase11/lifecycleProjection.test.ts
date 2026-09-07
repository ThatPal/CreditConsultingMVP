import { describe, expect, test } from 'vitest';
import { composeRoundLifecycle, type RoundLifecycleInput } from './lifecycleProjection.js';

const base = (patch: Partial<RoundLifecycleInput> = {}): RoundLifecycleInput => ({
  roundId: 'round-1', roundStatus: 'READY_FOR_STRATEGY', updatedAt: new Date('2026-09-06T12:00:00Z'),
  blockers: [], preparationComplete: true, majorCheckComplete: true, strategy: null,
  appointment: null, session: null, unresolvedFollowUpCount: 0, approvedAnalysis: null,
  activeRestrictions: [], finalized: false, ...patch,
});

describe('canonical Round lifecycle projection', () => {
  test('names consultant ownership while a prepared Round waits for Strategy', () => {
    const view = composeRoundLifecycle(base());
    expect(view).toMatchObject({ owner: 'CONSULTANT', mustActNow: false, nextAction: null });
    expect(view.waiting).toMatch(/do not need to act/i);
  });

  test('makes an approved Strategy and scheduling compatible with the overview', () => {
    const view = composeRoundLifecycle(base({ strategy: { status: 'APPROVED', version: 3, approvedAt: new Date('2026-09-06T12:01:00Z') } }));
    expect(view.currentState).toBe('Strategy approved');
    expect(view.nextAction).toMatchObject({ key: 'REVIEW_STRATEGY', path: '/app/rounds/round-1/strategy' });
    expect(view.stages.find((stage) => stage.key === 'STRATEGY')?.state).toBe('COMPLETED');
    expect(view.stages.find((stage) => stage.key === 'SCHEDULING')?.state).toBe('AVAILABLE');
  });

  test('projects booked and active live child objects without relying on Round status', () => {
    const strategy = { status: 'APPROVED', version: 1, approvedAt: new Date('2026-09-06T12:01:00Z') };
    const appointment = { status: 'BOOKED', startsAt: new Date('2026-09-07T12:00:00Z'), updatedAt: new Date('2026-09-06T12:02:00Z') };
    const booked = composeRoundLifecycle(base({ strategy, appointment }));
    expect(booked.nextAction?.key).toBe('REVIEW_APPOINTMENT');
    const live = composeRoundLifecycle(base({ strategy, appointment, session: { status: 'WAITING_FOR_CLIENT', updatedAt: new Date('2026-09-06T12:03:00Z'), endedAt: null } }));
    expect(live.nextAction).toMatchObject({ key: 'OPEN_LIVE_SESSION', path: '/app/rounds/round-1/live' });
    expect(live.stages.find((stage) => stage.key === 'LIVE')?.state).toBe('ACTIVE');
  });

  test('projects restrictions, follow-up, analysis and finalization with explicit owners', () => {
    expect(composeRoundLifecycle(base({ activeRestrictions: ['LIVE_EXECUTION'] }))).toMatchObject({ owner: 'CONSULTANT', mustActNow: false, blocker: 'MAJOR_COORDINATION_RESTRICTION' });
    expect(composeRoundLifecycle(base({ session: { status: 'COMPLETED', updatedAt: new Date(), endedAt: new Date() }, unresolvedFollowUpCount: 2 })).nextAction?.key).toBe('COMPLETE_FOLLOW_UP');
    expect(composeRoundLifecycle(base({ session: { status: 'COMPLETED', updatedAt: new Date(), endedAt: new Date() }, approvedAnalysis: { version: 2, approvedAt: new Date() } })).nextAction?.key).toBe('VIEW_ANALYSIS');
    expect(composeRoundLifecycle(base({ finalized: true }))).toMatchObject({ currentState: 'Round complete', owner: 'NONE' });
    expect(composeRoundLifecycle(base({ finalized: true, blockers: ['CURRENT_REVIEW_REQUIRED'] }))).toMatchObject({ currentState: 'Round complete', owner: 'NONE' });
  });
});
