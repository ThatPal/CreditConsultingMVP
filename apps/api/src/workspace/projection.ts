import { clientItemAvailability } from '../plans/clientAvailability.js';
// U1 read adapter over published PlanVersion/PlanItem. U4 replaces the source
// with CreditPlan/PlanItem; it must preserve these Action/Guidance distinctions.
type PlanRead = {
  id?: string;
  status: string;
  version: {
    id?: string;
    version?: number;
    staleAt?: Date | string | null;
    items: Array<{
      id: string;
      type: string;
      status: string;
      owner: string;
      title: string;
      completionMode?: string;
    }>;
  };
} | null;

export function summarizePlan(plan: PlanRead) {
  const items = (plan?.version.items ?? []).filter((item) => item.status !== 'CANCELLED');
  const actions = items.filter((item) => item.type === 'ACTION');
  const completedActionCount = actions.filter((item) => item.status === 'COMPLETED').length;
  const stale = plan?.status === 'STALE' || Boolean(plan?.version.staleAt);
  const canRespond = plan?.status === 'ACTIVE' && !stale;
  const safeItem = (item: NonNullable<PlanRead>['version']['items'][number] | undefined) =>
    item
      ? { id: item.id, type: item.type, status: item.status, owner: item.owner, title: item.title }
      : null;
  const nextClientItem = canRespond
    ? items.find(
        (item) =>
          clientItemAvailability({ status: plan!.status, staleAt: plan!.version.staleAt }, item)
            .canRespond,
      )
    : undefined;
  const verificationSteps = items.filter(
    (item) =>
      ['AVAILABLE', 'IN_PROGRESS'].includes(item.status) &&
      ['CONSULTANT_VERIFY', 'SYSTEM_VERIFY'].includes(item.completionMode ?? ''),
  );
  return {
    professionalVerificationCount: verificationSteps.length,
    professionalVerificationOwner: verificationSteps.some(
      (item) => item.completionMode === 'CONSULTANT_VERIFY',
    )
      ? 'CONSULTANT'
      : 'SYSTEM',
    status: stale ? 'STALE' : (plan?.status ?? 'NOT_AVAILABLE'),
    source: plan
      ? {
          planId: plan.id ?? null,
          versionId: plan.version.id ?? null,
          version: plan.version.version ?? null,
        }
      : null,
    canRespond,
    openActionCount: actions.length - completedActionCount,
    completedActionCount,
    totalActionCount: actions.length,
    progressPercent: actions.length
      ? Math.round((completedActionCount / actions.length) * 100)
      : null,
    guidanceCount: items.filter((item) => item.type === 'GUIDANCE').length,
    milestoneCount: items.filter((item) => item.type === 'MILESTONE').length,
    awaitingVerificationCount: items.filter((item) => item.status === 'AWAITING_VERIFICATION')
      .length,
    needsConsultantCount: items.filter((item) => item.status === 'UNABLE').length,
    nextClientItem: safeItem(nextClientItem),
  };
}

// U3 removes this PublishedCreditReview/CreditProfileState compatibility input.
// Currentness is a read assessment; immutable publication content is not edited.
export function profileCurrentness(
  input: {
    state: {
      status: string;
      sourceReviewId: string | null;
      staleAt: Date | null;
      updatedAt: Date;
    } | null;
    publication: { id: string; reviewId: string; publishedAt: Date; expiresAt: Date | null } | null;
    reviewInProgress: boolean;
  },
  now: Date,
) {
  const { state, publication } = input;
  const expired = Boolean(
    publication?.expiresAt && publication.expiresAt.getTime() <= now.getTime(),
  );
  const isCurrent = Boolean(
    publication &&
    state?.status === 'CURRENT' &&
    state.sourceReviewId === publication.reviewId &&
    !state.staleAt &&
    !expired,
  );
  const reason = !publication
    ? 'NO_PUBLICATION'
    : expired
      ? 'EXPIRED'
      : !state || state.sourceReviewId !== publication.reviewId
        ? 'BASIS_UNCONFIRMED'
        : state.status !== 'CURRENT' || state.staleAt
          ? 'REASSESSMENT_REQUIRED'
          : 'CURRENT';
  return {
    status: isCurrent
      ? 'CURRENT'
      : publication
        ? 'STALE'
        : input.reviewInProgress
          ? 'REVIEW_IN_PROGRESS'
          : 'NOT_AVAILABLE',
    isCurrent,
    reason,
    effectiveAt: publication?.publishedAt ?? null,
    expiresAt: publication?.expiresAt ?? null,
    staleAt: state?.staleAt ?? null,
    source: publication
      ? {
          publicationId: publication.id,
          reviewId: publication.reviewId,
          publishedAt: publication.publishedAt,
        }
      : null,
    stateUpdatedAt: state?.updatedAt ?? null,
  };
}
