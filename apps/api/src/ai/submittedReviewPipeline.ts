import type { PrismaClient } from '../generated/prisma/client.js';
import type { DocumentStorageRegistry } from '../storage/documentStorage.js';
import { parseSupportedReportBytes, type ReportSource } from './creditReportProcessing.js';
import type { PortfolioCard } from './creditReportReconciliation.js';
import { enqueueDurablePhase7Pipeline } from './durableCreditReportPipeline.js';
import type { DurableAIRuntime } from './durableRuntime.js';

export async function enqueueSubmittedReviewPipeline(
  prisma: PrismaClient,
  storage: DocumentStorageRegistry,
  runtime: DurableAIRuntime,
  reviewId: string,
) {
  const review = await prisma.creditReview.findUnique({
    where: { id: reviewId },
    include: {
      intake: { include: { reportDocument: true } },
      client: { include: { cards: true } },
    },
  });
  const document = review?.intake?.reportDocument;
  if (
    !review ||
    !document ||
    document.validationStatus !== 'ACCEPTED' ||
    !review.intake?.reportDate
  )
    throw new Error('SUBMITTED_REVIEW_SOURCE_UNAVAILABLE');
  const bytes = await storage.forProvider(document.storageProvider).read(document.storageKey);
  if (!bytes) throw new Error('SUBMITTED_REVIEW_SOURCE_BYTES_UNAVAILABLE');
  const source: ReportSource = {
    reportDocumentId: document.id,
    clientId: review.clientId,
    sha256: document.sha256,
    acceptedReportDate: review.intake.reportDate.toISOString().slice(0, 10),
    validationStatus: 'ACCEPTED',
  };
  const cards: PortfolioCard[] = review.client.cards.map((card) => ({
    id: card.id,
    issuer: card.issuer,
    cardName: card.cardName,
    ...(card.maskedIdentifier ? { maskedIdentifier: card.maskedIdentifier } : {}),
    portfolioType: card.portfolioType,
    ...(card.reportsToBureaus == null ? {} : { reportsToBureaus: card.reportsToBureaus }),
  }));
  return enqueueDurablePhase7Pipeline({
    runtime,
    source,
    report: parseSupportedReportBytes(bytes),
    cards,
    correlationId: `credit-review:${review.id}`,
  });
}

export async function recoverSubmittedReviewPipelines(
  prisma: PrismaClient,
  storage: DocumentStorageRegistry,
  runtime: DurableAIRuntime,
) {
  const reviews = await prisma.creditReview.findMany({
    where: {
      status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] },
      intake: { reportDocumentId: { not: null } },
    },
    select: { id: true, intake: { select: { reportDocumentId: true } } },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
  });
  for (const review of reviews) {
    const existing = await prisma.aIJob.findFirst({
      where: {
        relatedEntityType: 'CreditReportDocument',
        relatedEntityId: review.intake!.reportDocumentId!,
      },
      select: { id: true },
    });
    if (!existing) {
      try {
        await enqueueSubmittedReviewPipeline(prisma, storage, runtime, review.id);
      } catch {
        /* Fail closed per review; a later recovery pass may succeed. */
      }
    }
  }
}
