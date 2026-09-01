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
export type CardTypePreference =
  'UNSECURED_PREFERRED' | 'OPEN_TO_SECURED' | 'SECURED_DESIRED' | 'NO_PREFERENCE';
export type GoalOfferPreference = 'ZERO_APR' | 'BALANCE_TRANSFER' | 'REWARDS_POINTS';
export type FeePreference =
  'NO_ANNUAL_FEE_ONLY' | 'PROMOTIONAL_NO_FEE_ACCEPTABLE' | 'PREFER_NO_FEE_OPEN' | 'FEE_ACCEPTABLE';
export type GoalRecord = {
  id: string;
  clientId: string;
  goalType: GoalType;
  scope: GoalScope;
  targetAmount: number | null;
  currentAmount: number | null;
  allowAnnualFee: boolean;
  cardTypePreference: CardTypePreference;
  offerPreferences: GoalOfferPreference[];
  feePreference: FeePreference;
  preferenceNote: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  version: number;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type GoalInput = {
  goalType: GoalType;
  scope: GoalScope;
  targetAmount?: number | null | undefined;
  allowAnnualFee?: boolean | undefined;
  cardTypePreference: CardTypePreference;
  offerPreferences: GoalOfferPreference[];
  feePreference: FeePreference;
  preferenceNote?: string | null | undefined;
  priority: GoalPriority;
};
export type GoalUpdate = {
  version?: number | undefined;
  goalType?: GoalType | undefined;
  scope?: GoalScope | undefined;
  targetAmount?: number | null | undefined;
  allowAnnualFee?: boolean | undefined;
  cardTypePreference?: CardTypePreference | undefined;
  offerPreferences?: GoalOfferPreference[] | undefined;
  feePreference?: FeePreference | undefined;
  preferenceNote?: string | null | undefined;
  priority?: GoalPriority | undefined;
  status?: GoalStatus | undefined;
};
export type GoalCommandContext = {
  actorId: string;
  idempotencyKey: string;
  requestHash: string;
};
export interface GoalStore {
  list(clientId: string): Promise<GoalRecord[]>;
  create(clientId: string, input: GoalInput, context?: GoalCommandContext): Promise<GoalRecord>;
  update(
    clientId: string,
    goalId: string,
    input: GoalUpdate,
    context?: GoalCommandContext,
  ): Promise<GoalRecord | null>;
  archive(
    clientId: string,
    goalId: string,
    context?: GoalCommandContext,
  ): Promise<GoalRecord | null>;
}
