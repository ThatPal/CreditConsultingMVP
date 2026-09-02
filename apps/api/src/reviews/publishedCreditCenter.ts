import type { PrismaClient } from '../generated/prisma/client.js';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getPublishedCreditCenter(prisma: PrismaClient, clientId: string) {
  const publications = await prisma.publishedCreditReview.findMany({
    where: { clientId },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    include: {
      review: {
        select: {
          intake: {
            select: {
              reportDate: true,
              reportSource: true,
              reportDocument: {
                select: {
                  id: true,
                  originalFileName: true,
                  mimeType: true,
                  sizeBytes: true,
                  uploadedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const history = publications.map((publication) => ({
    id: publication.id,
    reviewId: publication.reviewId,
    publishedAt: publication.publishedAt,
    recommendation: publication.recommendation,
    projection: asRecord(publication.clientSafeProjection),
    report: publication.review.intake?.reportDocument
      ? {
          ...publication.review.intake.reportDocument,
          reportDate: publication.review.intake.reportDate,
          reportSource: publication.review.intake.reportSource,
          contentPath: `/api/v1/reviews/report-documents/${publication.review.intake.reportDocument.id}/content`,
        }
      : null,
  }));
  const current = history[0] ?? null;
  const projection = current ? asRecord(current.projection) : {};
  const recommendation = asRecord(projection.recommendation);
  return {
    current,
    history,
    profile: {
      generalReadiness: current ? 'PUBLISHED' : 'NEEDS_REVIEW',
      freshness: {
        asOf: current?.publishedAt ?? null,
        expiresAt: null,
        isCurrent: Boolean(current),
      },
      review: current
        ? {
            id: current.reviewId,
            status: 'COMPLETE',
            completedAt: current.publishedAt,
            clientSummary:
              typeof projection.analysisSummary === 'string' ? projection.analysisSummary : null,
            recommendation:
              typeof recommendation.outcome === 'string' ? recommendation.outcome : null,
            findings: Array.isArray(projection.findings) ? projection.findings : [],
          }
        : null,
      history,
      actions: [],
    },
  };
}
