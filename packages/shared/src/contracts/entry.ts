import { z } from 'zod';

export const entryGoalValuesSchema = z
  .object({
    goalType: z.literal('TOTAL_AVAILABLE_CREDIT').default('TOTAL_AVAILABLE_CREDIT'),
    scope: z.enum(['PERSONAL', 'BUSINESS', 'BOTH']),
    targetAmount: z.number().int().min(5000).max(250000),
    allowAnnualFee: z.boolean().default(false),
    cardTypePreference: z.enum([
      'UNSECURED_PREFERRED',
      'OPEN_TO_SECURED',
      'SECURED_DESIRED',
      'NO_PREFERENCE',
    ]),
    offerPreferences: z
      .array(z.enum(['ZERO_APR', 'BALANCE_TRANSFER', 'REWARDS_POINTS']))
      .max(3)
      .transform((v) => [...new Set(v)]),
    feePreference: z.enum([
      'NO_ANNUAL_FEE_ONLY',
      'PROMOTIONAL_NO_FEE_ACCEPTABLE',
      'PREFER_NO_FEE_OPEN',
      'FEE_ACCEPTABLE',
    ]),
    preferenceNote: z.string().trim().max(500).nullable().default(null),
  })
  .strict();
export const intakeLocatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('TOKEN'), value: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  z.object({ kind: z.literal('CLAIM'), id: z.string().uuid() }).strict(),
]);
export const goalReferenceSchema = z
  .object({ id: z.string().uuid(), version: z.number().int().positive() })
  .strict();
export const intakeResolveSchema = z
  .object({
    locator: intakeLocatorSchema,
    decision: z.enum(['APPLY_SAVED', 'KEEP_CURRENT']),
    expectedIntakeVersion: z.number().int().positive(),
    expectedGoalSetVersion: z.number().int().nonnegative(),
    expectedCurrentGoal: goalReferenceSchema.nullable(),
  })
  .strict();
export type EntryGoalValues = Omit<
  z.infer<typeof entryGoalValuesSchema>,
  'goalType' | 'targetAmount'
> & {
  goalType: string;
  targetAmount: number | null;
};
export type IntakeLocator = z.infer<typeof intakeLocatorSchema>;
export type IntakeResolve = z.infer<typeof intakeResolveSchema>;
export type GoalReference = z.infer<typeof goalReferenceSchema>;
export type GoalResolutionReference = {
  id: string;
  intakeId: string;
  decision: IntakeResolve['decision'];
  effect: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'KEPT';
  goalId: string;
  goalVersion: number;
  goalRevisionId: string | null;
  resolvedAt: string;
};
export type IntakePreview = {
  schemaVersion: 1;
  clientId: string;
  actorId: string;
  intakeId: string;
  intakeVersion: number;
  expiresAt: string;
  goalSetVersion: number;
  savedGoal: EntryGoalValues;
  currentGoal: (GoalReference & EntryGoalValues) | null;
  state: 'NO_PRIMARY' | 'MATCHING' | 'DIFFERENT' | 'TARGET_CONFLICT';
  differences: { field: keyof EntryGoalValues; before: unknown; after: unknown }[];
  decisions: { decision: IntakeResolve['decision']; enabled: boolean; reasonCode?: string }[];
  resolution?: GoalResolutionReference;
};
export type PendingIntake = {
  claimId: string;
  intakeId: string;
  intakeVersion: number;
  expiresAt: string;
  goalSummary: EntryGoalValues;
};
