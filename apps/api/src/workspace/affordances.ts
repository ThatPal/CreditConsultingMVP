import { clientItemAvailability } from '../plans/clientAvailability.js';

type Item = Parameters<typeof clientItemAvailability>[1] & { id: string; title: string };
type Plan = {
  id: string;
  status: string;
  version: { id: string; version: number; staleAt?: Date | string | null; items: Item[] };
};
type Source = { planId: string; versionId: string; version: number; itemId: string | null };
export type WorkspaceAction =
  | { code: 'OPEN_CURRENT_FOCUS'; kind: 'NAVIGATION'; label: string; href: string }
  | {
      code: 'COMPLETE_PLAN_ITEM' | 'REQUEST_PLAN_HELP';
      kind: 'COMMAND';
      source: Source;
      requiresRevalidation: true;
    };
export type WorkspaceBlocker = {
  code:
    | 'PLAN_READ_ONLY'
    | 'STEP_LOCKED'
    | 'VERIFICATION_PENDING'
    | 'HELP_REQUESTED'
    | 'FORM_CONFIGURATION_REQUIRED';
  scope: 'PLAN_RESPONSES' | 'PLAN_ITEM_RESPONSES' | 'PLAN_ITEM_COMPLETION';
  owner: 'CONSULTANT' | 'SYSTEM' | null;
  message: string;
  source: Source;
};

// U1 compatibility adapter. U4 replaces PlanVersion/PlanItem sources.
// Affordances describe current reads, not command authorization or input validity.
export function workspaceAffordances(input: {
  currentFocus: { action: string; actionLabel: string };
  plan: Plan | null;
}) {
  const availableActions: WorkspaceAction[] = [
    {
      code: 'OPEN_CURRENT_FOCUS',
      kind: 'NAVIGATION',
      label: input.currentFocus.actionLabel,
      href: input.currentFocus.action,
    },
  ];
  const blockers: WorkspaceBlocker[] = [];
  const plan = input.plan;
  if (!plan) return { availableActions, blockers };
  const source = (itemId: string | null): Source => ({
    planId: plan.id,
    versionId: plan.version.id,
    version: plan.version.version,
    itemId,
  });
  if (plan.status !== 'ACTIVE' || plan.version.staleAt) {
    if (!['COMPLETED', 'CANCELLED'].includes(plan.status))
      blockers.push({
        code: 'PLAN_READ_ONLY',
        scope: 'PLAN_RESPONSES',
        owner: 'CONSULTANT',
        message: 'Your consultant must review this Plan before new responses can be submitted.',
        source: source(null),
      });
    return { availableActions, blockers };
  }
  for (const item of plan.version.items) {
    if (['COMPLETED', 'CANCELLED'].includes(item.status)) continue;
    const availability = clientItemAvailability(
      { status: plan.status, staleAt: plan.version.staleAt },
      item,
    );
    if (availability.canSubmitCompletion)
      availableActions.push({
        code: 'COMPLETE_PLAN_ITEM',
        kind: 'COMMAND',
        source: source(item.id),
        requiresRevalidation: true,
      });
    if (availability.canRequestHelp)
      availableActions.push({
        code: 'REQUEST_PLAN_HELP',
        kind: 'COMMAND',
        source: source(item.id),
        requiresRevalidation: true,
      });
    const code =
      item.status === 'LOCKED'
        ? 'STEP_LOCKED'
        : item.status === 'AWAITING_VERIFICATION'
          ? 'VERIFICATION_PENDING'
          : item.status === 'UNABLE'
            ? 'HELP_REQUESTED'
            : availability.reason === 'FORM_CONFIGURATION_REQUIRED'
              ? 'FORM_CONFIGURATION_REQUIRED'
              : null;
    if (!code) continue;
    const message = {
      STEP_LOCKED: 'This step is waiting for its prerequisites.',
      VERIFICATION_PENDING: 'Your submitted response is awaiting verification.',
      HELP_REQUESTED: 'Your consultant is reviewing your help request.',
      FORM_CONFIGURATION_REQUIRED: 'The response form needs attention. You can still ask for help.',
    }[code];
    blockers.push({
      code,
      scope:
        code === 'FORM_CONFIGURATION_REQUIRED' ? 'PLAN_ITEM_COMPLETION' : 'PLAN_ITEM_RESPONSES',
      owner:
        code === 'STEP_LOCKED'
          ? null
          : item.completionMode === 'SYSTEM_VERIFY'
            ? 'SYSTEM'
            : 'CONSULTANT',
      message,
      source: source(item.id),
    });
  }
  return { availableActions, blockers };
}
