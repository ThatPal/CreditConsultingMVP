export type LifecycleOwner = 'CLIENT' | 'CONSULTANT' | 'SYSTEM' | 'ADMIN' | 'NONE';

export type LifecycleAction = {
  key: string;
  label: string;
  path: string;
};

export type LifecycleStage = {
  key: 'PREPARATION' | 'MAJOR_CHECK' | 'STRATEGY' | 'SCHEDULING' | 'LIVE' | 'FOLLOW_UP' | 'ANALYSIS';
  label: string;
  state: 'COMPLETED' | 'ACTIVE' | 'AVAILABLE' | 'LOCKED';
  path: string;
};

export type RoundLifecycleInput = {
  roundId: string;
  roundStatus: string;
  updatedAt: Date;
  blockers: string[];
  preparationComplete: boolean;
  majorCheckComplete: boolean;
  strategy: null | { status: string; version: number | null; approvedAt: Date | null };
  appointment: null | { status: string; startsAt: Date; updatedAt: Date };
  session: null | { status: string; updatedAt: Date; endedAt: Date | null };
  unresolvedFollowUpCount: number;
  approvedAnalysis: null | { version: number; approvedAt: Date | null };
  activeRestrictions: string[];
  finalized: boolean;
};

const action = (key: string, label: string, path: string): LifecycleAction => ({ key, label, path });

export function composeRoundLifecycle(input: RoundLifecycleInput) {
  const base = `/app/rounds/${input.roundId}`;
  const strategyApproved = input.strategy?.status === 'APPROVED';
  const strategyStale = input.strategy?.status === 'STALE';
  const appointmentBooked = input.appointment?.status === 'BOOKED';
  const sessionActive = Boolean(input.session && !['COMPLETED', 'CANCELLED'].includes(input.session.status));
  const sessionComplete = Boolean(input.session?.endedAt || input.session?.status === 'COMPLETED');
  const restricted = input.activeRestrictions.length > 0;

  let currentState = 'Preparing your Round';
  let meaning = 'Complete the required preparation before your consultant creates a Strategy.';
  let owner: LifecycleOwner = 'CLIENT';
  let mustActNow = true;
  let nextAction: LifecycleAction | null = null;
  let waiting: string | null = null;

  if (input.finalized) {
    currentState = 'Round complete';
    meaning = 'This Round is finalized. Its results and published analysis remain available in history.';
    owner = 'NONE';
    mustActNow = false;
    nextAction = action('VIEW_JOURNEY', 'View your Journey', '/app/journey');
  } else if (input.blockers.includes('CURRENT_REVIEW_REQUIRED')) {
    currentState = 'Credit Profile Review required';
    meaning = 'Your published Credit Profile is no longer current for this Round.';
    nextAction = action('START_REVIEW', 'Start a new Credit Profile Review', '/app/credit-center/review');
  } else if (input.blockers.includes('GOAL_CHANGED')) {
    currentState = 'Goal confirmation required';
    meaning = 'Your primary goal changed after this Round began. Confirm how the change affects this Round.';
    nextAction = action('REVIEW_GOAL', 'Review current goal', '/app/goals');
  } else if (input.blockers.includes('SOURCE_CONTEXT_CHANGED')) {
    currentState = 'Round context needs review';
    meaning = 'Your Plan, cards, or application information changed after this Round began.';
    owner = 'CONSULTANT';
    mustActNow = false;
    waiting = 'Your consultant needs to review the updated context before Strategy can continue.';
  } else if (sessionComplete && input.unresolvedFollowUpCount > 0) {
    currentState = 'Follow-up needed';
    meaning = `${input.unresolvedFollowUpCount} result ${input.unresolvedFollowUpCount === 1 ? 'item needs' : 'items need'} confirmation before the Round can be finalized.`;
    nextAction = action('COMPLETE_FOLLOW_UP', 'Complete Round follow-up', `${base}/follow-up`);
  } else if (sessionComplete && input.approvedAnalysis) {
    currentState = 'Round analysis published';
    meaning = `Your consultant published Round Analysis version ${input.approvedAnalysis.version}.`;
    owner = 'CLIENT';
    nextAction = action('VIEW_ANALYSIS', 'Review Round Analysis', `${base}/analysis`);
  } else if (sessionComplete) {
    currentState = 'Waiting for Round analysis';
    meaning = 'The live session is complete. Your consultant is reviewing the recorded results.';
    owner = 'CONSULTANT';
    mustActNow = false;
    waiting = 'You do not need to act now. We will notify you when your consultant publishes the analysis.';
  } else if (sessionActive) {
    currentState = 'Guided application session in progress';
    meaning = 'The committed session state is authoritative. Continue only with the card released by your consultant.';
    nextAction = action('OPEN_LIVE_SESSION', 'Return to live session', `${base}/live`);
  } else if (appointmentBooked) {
    currentState = 'Guided session scheduled';
    meaning = `Your appointment is booked for ${input.appointment!.startsAt.toISOString()}.`;
    nextAction = action('REVIEW_APPOINTMENT', 'Review scheduled session', `${base}/schedule`);
  } else if (strategyApproved && !restricted) {
    currentState = 'Strategy approved';
    meaning = `Consultant-approved Strategy version ${input.strategy!.version ?? 1} is ready for you to review.`;
    nextAction = action('REVIEW_STRATEGY', 'Review approved Strategy', `${base}/strategy`);
  } else if (restricted) {
    currentState = 'Card activity paused for coordination';
    meaning = 'An active Major application coordination decision currently restricts this Round.';
    owner = 'CONSULTANT';
    mustActNow = false;
    waiting = 'Your consultant must reassess the coordination decision before card activity can continue.';
    nextAction = action('VIEW_MAJOR_READINESS', 'View Major application coordination', '/app/major-readiness');
  } else if (strategyStale) {
    currentState = 'Strategy update required';
    meaning = 'Information changed after the prior Strategy was approved.';
    owner = 'CONSULTANT';
    mustActNow = false;
    waiting = 'Your consultant needs to review the change and publish a current Strategy before scheduling.';
  } else if (input.blockers.length === 0) {
    currentState = 'Waiting for consultant Strategy';
    meaning = 'Round preparation is complete. Your consultant now owns Strategy preparation and approval.';
    owner = 'CONSULTANT';
    mustActNow = false;
    waiting = 'You do not need to act now. We will notify you when the approved Strategy is ready.';
  } else if (!input.preparationComplete) {
    nextAction = action('COMPLETE_PREPARATION', 'Continue preparation Plan', '/app/plan');
  } else if (!input.majorCheckComplete) {
    nextAction = action('ANSWER_MAJOR_CHECK', 'Answer Major application check', `${base}/major-check`);
  } else {
    currentState = 'Round needs attention';
    meaning = 'A current prerequisite must be resolved before Strategy preparation can continue.';
    nextAction = action('REVIEW_ROUND', 'Review Round requirements', base);
  }

  const stages: LifecycleStage[] = [
    { key: 'PREPARATION', label: 'Preparation', state: input.preparationComplete ? 'COMPLETED' : 'ACTIVE', path: '/app/plan' },
    { key: 'MAJOR_CHECK', label: 'Major application check', state: input.majorCheckComplete ? 'COMPLETED' : input.preparationComplete ? 'AVAILABLE' : 'LOCKED', path: `${base}/major-check` },
    { key: 'STRATEGY', label: 'Approved Strategy', state: strategyApproved ? 'COMPLETED' : input.blockers.length === 0 && !restricted ? 'AVAILABLE' : 'LOCKED', path: `${base}/strategy` },
    { key: 'SCHEDULING', label: 'Scheduling', state: appointmentBooked ? 'COMPLETED' : strategyApproved && !restricted ? 'AVAILABLE' : 'LOCKED', path: `${base}/schedule` },
    { key: 'LIVE', label: 'Guided application session', state: sessionComplete ? 'COMPLETED' : sessionActive ? 'ACTIVE' : appointmentBooked && !restricted ? 'AVAILABLE' : 'LOCKED', path: `${base}/live` },
    { key: 'FOLLOW_UP', label: 'Round follow-up', state: input.unresolvedFollowUpCount > 0 ? 'ACTIVE' : sessionComplete ? 'COMPLETED' : 'LOCKED', path: `${base}/follow-up` },
    { key: 'ANALYSIS', label: 'Round Analysis', state: input.approvedAnalysis ? 'COMPLETED' : sessionComplete ? 'AVAILABLE' : 'LOCKED', path: `${base}/analysis` },
  ];

  const freshness = [
    input.updatedAt,
    input.appointment?.updatedAt,
    input.session?.updatedAt,
    input.strategy?.approvedAt,
    input.approvedAnalysis?.approvedAt,
  ].filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0]!;

  return {
    key: currentState.replaceAll(' ', '_').toUpperCase(),
    currentState,
    meaning,
    owner,
    mustActNow,
    blocker: input.blockers[0] ?? (restricted ? 'MAJOR_COORDINATION_RESTRICTION' : null),
    nextAction,
    waiting,
    freshness: freshness.toISOString(),
    strategy: input.strategy,
    appointment: input.appointment,
    session: input.session,
    postRound: { unresolvedFollowUpCount: input.unresolvedFollowUpCount, approvedAnalysis: input.approvedAnalysis, finalized: input.finalized },
    stages,
  };
}
