import type { PrismaClient } from '../generated/prisma/client.js';
import { getClientPlan } from '../plans/service.js';
import { resolveCurrentFocus } from '../journey/projection.js';
import { profileCurrentness } from './projection.js';

// Read-only compatibility composition, not a new workflow or persisted state.
// Plan/Review/Cycle/Nurture sources retire in U4/U3/U6/U4 respectively.
// Callers enforce client/consultant scope before entering this service.
export async function getCreditWorkspace(
  prisma: PrismaClient,
  clientId: string,
  suppliedPlan?: Awaited<ReturnType<typeof getClientPlan>>,
  now = new Date(),
  publicationBasis?: {
    id: string;
    reviewId: string;
    publishedAt: Date;
    review: { readinessExpiresAt: Date | null };
  } | null,
) {
  const [plan, state, publication, review, goal, journey, rounds, appointment] = await Promise.all([
    suppliedPlan ?? getClientPlan(prisma, clientId),
    prisma.creditProfileState.findUnique({
      where: { clientId },
      select: {
        status: true,
        sourceReviewId: true,
        staleAt: true,
        updatedAt: true,
      },
    }),
    publicationBasis !== undefined
      ? publicationBasis
      : prisma.publishedCreditReview.findFirst({
          where: { clientId },
          orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            reviewId: true,
            publishedAt: true,
            review: { select: { readinessExpiresAt: true } },
          },
        }),
    prisma.creditReview.findFirst({
      where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.clientGoal.findFirst({ where: { clientId, status: 'ACTIVE' }, select: { id: true } }),
    prisma.creditJourney.findUnique({
      where: { clientId },
      select: {
        cycles: {
          where: { status: 'ACTIVE' },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { id: true, currentStage: true },
        },
        nurturePeriods: {
          where: { status: 'ACTIVE' },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { reasonCode: true },
        },
      },
    }),
    prisma.creditCardRound.findMany({
      where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
      select: { id: true, status: true, strategy: { select: { status: true } } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.appointment.findFirst({
      where: { clientId, status: 'BOOKED', endsAt: { gt: now } },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        status: true,
        roundId: true,
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const round =
    rounds.find((r) => r.status === 'BLOCKED') ??
    rounds.find((r) => r.strategy?.status === 'STALE') ??
    rounds[0] ??
    null;
  const currentFocus = resolveCurrentFocus({
    activeCycle: journey?.cycles[0] ?? null,
    activeNurture: journey?.nurturePeriods[0] ?? null,
    hasGoal: Boolean(goal),
    round,
    plan: plan.summary,
  });
  const profile = profileCurrentness(
    {
      state,
      publication: publication
        ? {
            id: publication.id,
            reviewId: publication.reviewId,
            publishedAt: publication.publishedAt,
            expiresAt: publication.review.readinessExpiresAt,
          }
        : null,
      reviewInProgress: Boolean(review),
    },
    now,
  );
  return {
    generatedAt: now,
    currentFocus,
    plan: plan.summary,
    profile,
    nextAppointment: appointment,
    // Versions represent the actual source basis, never a synthetic global revision.
    sources: {
      plan: plan.summary.source,
      profile: profile.source,
      profileStateUpdatedAt: profile.stateUpdatedAt,
    },
  };
}
