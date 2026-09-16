import type { PrismaClient } from '../generated/prisma/client.js';

// U1 source-linked published recommendations/decisions, not activity-log inference.
// U4 replaces this with the global CreditPlan decision projection; U3/U6 own source adapters.
export async function getPlanDecisions(prisma: PrismaClient, clientId: string) {
  const [reviews, decisions] = await Promise.all([
    prisma.publishedCreditReview.findMany({
      where: { clientId },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: { id: true, reviewId: true, publishedAt: true, clientSafeProjection: true },
    }),
    prisma.coordinationDecision.findMany({
      where: { case: { clientId } },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: {
        id: true,
        caseId: true,
        version: true,
        clientSafeExplanation: true,
        effectiveAt: true,
        supersededAt: true,
      },
    }),
  ]);
  const published = reviews.flatMap((review) => {
    const value = review.clientSafeProjection;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const recommendation = value.recommendation;
    if (
      !recommendation ||
      typeof recommendation !== 'object' ||
      Array.isArray(recommendation) ||
      typeof recommendation.explanation !== 'string' ||
      !recommendation.explanation.trim()
    )
      return [];
    return [
      {
        id: review.id,
        title: 'Credit Review recommendation',
        explanation: recommendation.explanation,
        publishedAt: review.publishedAt,
        historical: true,
        href: '/app/credit-center/history',
        sourceLabel: 'Published Credit Review',
      },
    ];
  });
  return [
    ...published,
    ...decisions.map((decision) => ({
      id: decision.id,
      title: 'Major Readiness coordination',
      explanation: decision.clientSafeExplanation,
      publishedAt: decision.effectiveAt,
      historical: Boolean(decision.supersededAt),
      href: '/app/major-readiness/coordination?caseId=' + encodeURIComponent(decision.caseId),
      sourceLabel: 'Coordination decision · version ' + decision.version,
    })),
  ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id));
}
