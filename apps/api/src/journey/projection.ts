import { summarizePlan } from '../workspace/projection.js';
export { summarizePlan } from '../workspace/projection.js';
import type {
  ApplicationCycleStage,
  ApplicationCycleStatus,
  AppointmentStatus,
} from '../generated/prisma/enums.js';

export type FocusInput = {
  activeNurture: { reasonCode: string } | null;
  activeCycle: { id: string; currentStage: ApplicationCycleStage } | null;
  hasGoal: boolean;
  round?: { id: string; status: string; strategy: { status: string } | null } | null;
  plan?: ReturnType<typeof summarizePlan>;
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
  if (input.round?.status === 'BLOCKED')
    return {
      code: 'ROUND_BLOCKED',
      title: 'Your round needs a consultant review',
      detail: 'Your consultant must resolve a restriction before applications can continue.',
      owner: 'CONSULTANT',
      actionLabel: 'View round status',
      action: `/app/rounds/${input.round.id}`,
    };
  if (input.round?.strategy?.status === 'STALE')
    return {
      code: 'STRATEGY_STALE',
      title: 'Your consultant is updating your strategy',
      detail:
        'Information used to prepare your strategy has changed. Wait for the updated strategy before applying.',
      owner: 'CONSULTANT',
      actionLabel: 'View round status',
      action: `/app/rounds/${input.round.id}`,
    };
  if (input.plan?.status === 'STALE')
    return {
      code: 'PLAN_STALE',
      title: 'Your consultant is reviewing your Plan',
      detail:
        'Your completed work is saved. The Plan needs review after a change to its source information.',
      owner: 'CONSULTANT',
      actionLabel: 'View your Plan',
      action: '/app/plan',
    };
  if (input.plan?.nextClientItem)
    return {
      code: 'PLAN_ACTION',
      title: input.plan.nextClientItem.title,
      detail: 'Continue this available step in your Plan.',
      owner: 'CLIENT',
      actionLabel: 'Continue your Plan',
      action:
        '/app/plan?' +
        new URLSearchParams({
          view: input.plan.nextClientItem.type === 'ACTION' ? 'actions' : 'guidance',
          item: input.plan.nextClientItem.id,
        }).toString(),
    };
  if (input.plan?.awaitingVerificationCount)
    return {
      code: 'PLAN_VERIFICATION',
      title: 'Your consultant is checking your update',
      detail: 'Your update is saved. Your consultant owns the next step.',
      owner: 'CONSULTANT',
      actionLabel: 'View your Plan',
      action: '/app/plan',
    };
  if (input.plan?.needsConsultantCount)
    return {
      code: 'PLAN_HELP',
      title: 'Your consultant is reviewing your request',
      detail: 'Your request is saved. Wait for guidance before continuing this step.',
      owner: 'CONSULTANT',
      actionLabel: 'View your Plan',
      action: '/app/plan',
    };
  if (input.plan?.professionalVerificationCount)
    return {
      code: 'PLAN_CHECK',
      title: 'Your Plan has a verification step',
      detail:
        'These steps require verification before they can be completed. You do not need to submit a response.',
      owner: input.plan.professionalVerificationOwner,
      actionLabel: 'View your Plan',
      action: '/app/plan',
    };
  if (input.activeNurture)
    return {
      code: 'NURTURE',
      title: 'Continue your preparation period',
      detail: input.activeNurture.reasonCode.replaceAll('_', ' ').toLowerCase(),
      action: '/app/journey',
      owner: 'CLIENT',
      actionLabel: 'View your journey',
    };
  if (input.activeCycle)
    return {
      ...stageFocus[input.activeCycle.currentStage],
      detail: null,
      owner: ['CONSULTANT_DECISION', 'STRATEGY'].includes(input.activeCycle.currentStage)
        ? 'CONSULTANT'
        : 'CLIENT',
      actionLabel: 'View next step',
    };
  if (input.hasGoal)
    return {
      code: 'READY_FOR_CYCLE',
      title: 'Your goal is ready for the next guided step',
      detail: 'A new application cycle has not started.',
      action: '/app/journey',
      owner: 'CONSULTANT',
      actionLabel: 'View your journey',
    };
  return {
    code: 'SET_GOAL',
    title: 'Choose your primary credit goal',
    detail: 'Your journey starts with a clear goal.',
    action: '/app/goals',
    owner: 'CLIENT',
    actionLabel: 'Set your desired credit amount',
  };
}

export function classifyCycle(status: ApplicationCycleStatus) {
  return status === 'ACTIVE' ? 'CURRENT' : 'HISTORY';
}

export function appointmentFoundationStatus(status: AppointmentStatus | null) {
  return status ?? 'NOT_AVAILABLE';
}
