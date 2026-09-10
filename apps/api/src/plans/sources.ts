import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

export type PlanSources = {
  sourceReviewId?: string | null;
  sourceReviewVersion?: number | null;
  sourceGoalRevisionId?: string | null;
  sourceProfileVersion?: number | null;
};
export function sourceFingerprint(input: PlanSources) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceReviewId: input.sourceReviewId ?? null,
        sourceReviewVersion: input.sourceReviewVersion ?? null,
        sourceGoalRevisionId: input.sourceGoalRevisionId ?? null,
        sourceProfileVersion: input.sourceProfileVersion ?? null,
      }),
    )
    .digest('hex');
}

export async function currentPlanSources(tx: Prisma.TransactionClient, clientId: string) {
  const publication = await tx.publishedCreditReview.findFirst({
    where: { clientId },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    select: { reviewId: true, publishedAt: true },
  });
  const goal = await tx.clientGoal.findFirst({
    where: { clientId, status: 'ACTIVE' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const goalRevision = goal
    ? await tx.clientGoalRevision.findFirst({
        where: { goalId: goal.id, clientId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, targetAmount: true, createdAt: true },
      })
    : null;
  return {
    publication,
    goalRevision,
    sources: {
      sourceReviewId: publication?.reviewId ?? null,
      sourceReviewVersion: null,
      sourceGoalRevisionId: goalRevision?.id ?? null,
      sourceProfileVersion: null,
    },
  };
}

export async function assertPlanSourceOwnership(
  tx: Prisma.TransactionClient,
  clientId: string,
  sources: PlanSources,
) {
  if (
    sources.sourceReviewId &&
    !(await tx.publishedCreditReview.findFirst({
      where: { clientId, reviewId: sources.sourceReviewId },
      select: { id: true },
    }))
  )
    throw new AppError(
      'PLAN_SOURCE_INVALID',
      409,
      'Choose a published review belonging to this client.',
    );
  if (
    sources.sourceGoalRevisionId &&
    !(await tx.clientGoalRevision.findFirst({
      where: { clientId, id: sources.sourceGoalRevisionId },
      select: { id: true },
    }))
  )
    throw new AppError(
      'PLAN_SOURCE_INVALID',
      409,
      'Choose a saved goal revision belonging to this client.',
    );
}

export async function assertPlanSourcesCurrent(
  tx: Prisma.TransactionClient,
  clientId: string,
  sources: PlanSources,
) {
  await assertPlanSourceOwnership(tx, clientId, sources);
  const current = await currentPlanSources(tx, clientId);
  if (sourceFingerprint(sources) !== sourceFingerprint(current.sources))
    throw new AppError(
      'PLAN_SOURCES_CHANGED',
      409,
      'The Plan uses different source information. Compare sources and review the changes before approval.',
    );
}

export async function comparePlanSources(
  tx: Prisma.TransactionClient,
  clientId: string,
  saved: PlanSources,
) {
  const current = await currentPlanSources(tx, clientId);
  const previousReview = saved.sourceReviewId
    ? await tx.publishedCreditReview.findFirst({
        where: { clientId, reviewId: saved.sourceReviewId },
        select: { publishedAt: true },
      })
    : null;
  const previousGoal = saved.sourceGoalRevisionId
    ? await tx.clientGoalRevision.findFirst({
        where: { clientId, id: saved.sourceGoalRevisionId },
        select: { version: true, targetAmount: true },
      })
    : null;
  const reviewLabel = (review: { publishedAt: Date } | null) =>
    review
      ? `Published ${review.publishedAt.toISOString().slice(0, 10)}`
      : 'No published review linked';
  const goalLabel = (
    goal: { version: number; targetAmount: { toString(): string } | null } | null,
  ) =>
    goal
      ? `Revision ${goal.version}${goal.targetAmount ? ` · Desired amount $${Number(goal.targetAmount.toString()).toLocaleString('en-US')}` : ''}`
      : 'No goal revision linked';
  const changes = [
    {
      field: 'sourceReviewId',
      label: 'Published Credit Review',
      before: reviewLabel(previousReview),
      after: reviewLabel(current.publication),
      changed: (saved.sourceReviewId ?? null) !== current.sources.sourceReviewId,
    },
    {
      field: 'sourceGoalRevisionId',
      label: 'Primary goal',
      before: goalLabel(previousGoal),
      after: goalLabel(current.goalRevision),
      changed: (saved.sourceGoalRevisionId ?? null) !== current.sources.sourceGoalRevisionId,
    },
    ...(['sourceReviewVersion', 'sourceProfileVersion'] as const)
      .filter((field) => saved[field] != null)
      .map((field) => ({
        field,
        label: field === 'sourceReviewVersion' ? 'Legacy review version' : 'Legacy profile version',
        before: `Version ${saved[field]}`,
        after: 'Use the published review reference',
        changed: true,
      })),
  ];
  return {
    sources: current.sources,
    fingerprint: sourceFingerprint(current.sources),
    changed: changes.some((entry) => entry.changed),
    changes,
  };
}
