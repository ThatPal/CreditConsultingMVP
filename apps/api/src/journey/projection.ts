import type { ApplicationCycleStage, ApplicationCycleStatus } from '../generated/prisma/enums.js';

export type FocusInput = {
  activeNurture: { reasonCode: string } | null;
  activeCycle: { id: string; currentStage: ApplicationCycleStage } | null;
  hasGoal: boolean;
};

const stageFocus: Record<ApplicationCycleStage, { code: string; title: string; action: string }> = {
  STARTED: { code: 'CONFIRM_GOAL', title: 'Confirm your goal', action: '/app/goals' },
  REVIEW_PURCHASE: {
    code: 'START_REVIEW',
    title: 'Start your credit review',
    action: '/app/credit-center',
  },
  CREDIT_REVIEW: {
    code: 'COMPLETE_REVIEW',
    title: 'Complete your credit review',
    action: '/app/credit-center/review',
  },
  CONSULTANT_DECISION: {
    code: 'AWAIT_DECISION',
    title: 'Your review is being assessed',
    action: '/app/credit-center',
  },
  POST_REVIEW_ACTIONS: {
    code: 'COMPLETE_PREPARATION',
    title: 'Complete your preparation actions',
    action: '/app/readiness',
  },
  ROUND_PURCHASE: {
    code: 'ROUND_NOT_AVAILABLE',
    title: 'Application-round access is not available yet',
    action: '/app/application-rounds',
  },
  STRATEGY: {
    code: 'STRATEGY_IN_PROGRESS',
    title: 'Your strategy is being prepared',
    action: '/app/application-rounds',
  },
  APPLICATION_SEQUENCE: {
    code: 'SEQUENCE_IN_PROGRESS',
    title: 'Review your application sequence',
    action: '/app/application-rounds',
  },
  APPLICATION_ROUND: {
    code: 'ROUND_IN_PROGRESS',
    title: 'Continue your application round',
    action: '/app/application-rounds',
  },
  RESULTS: {
    code: 'RECORD_RESULTS',
    title: 'Review application results',
    action: '/app/application-rounds',
  },
  POST_APPLICATION_ACTIONS: {
    code: 'POST_ROUND_ACTIONS',
    title: 'Complete post-round actions',
    action: '/app/application-rounds',
  },
  FINAL_RESULTS: {
    code: 'REVIEW_CYCLE_RESULT',
    title: 'Review this cycle’s result',
    action: '/app/application-rounds',
  },
};

export function resolveCurrentFocus(input: FocusInput) {
  if (input.activeNurture)
    return {
      code: 'NURTURE',
      title: 'Continue your preparation period',
      detail: input.activeNurture.reasonCode.replaceAll('_', ' ').toLowerCase(),
      action: '/app/journey',
    };
  if (input.activeCycle) return { ...stageFocus[input.activeCycle.currentStage], detail: null };
  if (input.hasGoal)
    return {
      code: 'READY_FOR_CYCLE',
      title: 'Your goal is ready for the next guided step',
      detail: 'A new application cycle has not started.',
      action: '/app/journey',
    };
  return {
    code: 'SET_GOAL',
    title: 'Choose your primary credit goal',
    detail: 'Your journey starts with a clear goal.',
    action: '/app/goals',
  };
}

export function classifyCycle(status: ApplicationCycleStatus) {
  return status === 'ACTIVE' ? 'CURRENT' : 'HISTORY';
}
