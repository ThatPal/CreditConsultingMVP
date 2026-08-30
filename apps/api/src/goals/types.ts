export type GoalType =
  | 'ZERO_APR_CREDIT'
  | 'TOTAL_AVAILABLE_CREDIT'
  | 'BUSINESS_CREDIT'
  | 'PERSONAL_CREDIT'
  | 'BALANCE_TRANSFER_CAPACITY'
  | 'EXISTING_LIMIT_INCREASES'
  | 'REWARDS_POINTS_PORTFOLIO';
export type GoalScope = 'PERSONAL' | 'BUSINESS' | 'BOTH';
export type GoalPriority = 'PRIMARY' | 'SECONDARY';
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'PAUSED';
export type GoalRecord = {
  id: string;
  clientId: string;
  goalType: GoalType;
  scope: GoalScope;
  targetAmount: number | null;
  currentAmount: number | null;
  allowAnnualFee: boolean;
  priority: GoalPriority;
  status: GoalStatus;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type GoalInput = {
  goalType: GoalType;
  scope: GoalScope;
  targetAmount?: number | null | undefined;
  allowAnnualFee?: boolean | undefined;
  priority: GoalPriority;
};
export type GoalUpdate = {
  goalType?: GoalType | undefined;
  scope?: GoalScope | undefined;
  targetAmount?: number | null | undefined;
  allowAnnualFee?: boolean | undefined;
  priority?: GoalPriority | undefined;
  status?: GoalStatus | undefined;
};
export interface GoalStore {
  list(clientId: string): Promise<GoalRecord[]>;
  create(clientId: string, input: GoalInput): Promise<GoalRecord>;
  update(clientId: string, goalId: string, input: GoalUpdate): Promise<GoalRecord | null>;
  archive(clientId: string, goalId: string): Promise<GoalRecord | null>;
}
