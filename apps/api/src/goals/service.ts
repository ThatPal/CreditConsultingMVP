import { AppError } from '../http/errors.js';
import type { GoalCommandContext, GoalInput, GoalStore, GoalType, GoalUpdate } from './types.js';
const monetary = new Set<GoalType>([
  'ZERO_APR_CREDIT',
  'TOTAL_AVAILABLE_CREDIT',
  'BUSINESS_CREDIT',
  'PERSONAL_CREDIT',
  'BALANCE_TRANSFER_CAPACITY',
  'EXISTING_LIMIT_INCREASES',
]);
function validate(input: GoalUpdate) {
  if (
    input.priority === 'PRIMARY' &&
    input.goalType &&
    monetary.has(input.goalType) &&
    input.targetAmount === null
  )
    throw new AppError('VALIDATION_ERROR', 400, 'A target amount is required for this goal');
  if (input.targetAmount !== undefined && input.targetAmount !== null && input.targetAmount <= 0)
    throw new AppError('VALIDATION_ERROR', 400, 'Target amount must be greater than zero');
}
export function createGoalService(store: GoalStore) {
  return {
    list: (clientId: string) => store.list(clientId),
    async create(clientId: string, input: GoalInput, context?: GoalCommandContext) {
      validate(input);
      return store.create(clientId, input, context);
    },
    async update(
      clientId: string,
      goalId: string,
      input: GoalUpdate,
      context?: GoalCommandContext,
    ) {
      validate(input);
      const goal = await store.update(clientId, goalId, input, context);
      if (!goal) throw new AppError('NOT_FOUND', 404, 'Goal not found');
      return goal;
    },
    async archive(clientId: string, goalId: string, context?: GoalCommandContext) {
      const goal = await store.archive(clientId, goalId, context);
      if (!goal) throw new AppError('NOT_FOUND', 404, 'Goal not found');
      return goal;
    },
  };
}
export type GoalService = ReturnType<typeof createGoalService>;
