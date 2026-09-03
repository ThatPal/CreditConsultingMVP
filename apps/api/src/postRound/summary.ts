import type { CreditApplicationOutcome, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

type ApplicationFact = { status: string; outcome: CreditApplicationOutcome | null; approvedLimitKnown: boolean | null; approvedLimit: { toString(): string } | null };

export function aggregateRoundFacts(applications: ApplicationFact[], targetAmount?: number | null) {
  const counts = { submitted: 0, approved: 0, approvedLimitPending: 0, declined: 0, pending: 0, other: 0, skipped: 0 };
  let knownApprovedAmount = 0;
  for (const item of applications) {
    if (item.status === 'SKIPPED') { counts.skipped += 1; continue; }
    counts.submitted += 1;
    if (item.outcome === 'APPROVED') {
      counts.approved += 1;
      const amount = Number(item.approvedLimit?.toString() ?? 0);
      if (item.approvedLimitKnown && amount > 0) knownApprovedAmount += amount;
      else counts.approvedLimitPending += 1;
    } else if (item.outcome === 'DECLINED') counts.declined += 1;
    else if (item.outcome === 'PENDING') counts.pending += 1;
    else counts.other += 1;
  }
  const unresolvedFollowUpCount = counts.pending + counts.approvedLimitPending;
  return { counts, knownApprovedAmount, unresolvedFollowUpCount, goal: targetAmount && targetAmount > 0 ? { targetAmount, progressAmount: knownApprovedAmount, progressPercent: Math.min(100, Math.round((knownApprovedAmount / targetAmount) * 100)) } : null };
}

export async function getPostRoundSummary(prisma: PrismaClient, roundId: string, clientId: string, consultant = false) {
  const round = await prisma.creditCardRound.findFirst({ where: { id: roundId, clientId }, include: { goalSnapshot: true } });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  const applications = await prisma.creditApplication.findMany({ where: { roundId, clientId }, orderBy: [{ releasedAt: 'asc' }, { id: 'asc' }] });
  const products = await prisma.cardProduct.findMany({ where: { id: { in: applications.map((item) => item.productId) } }, select: { id: true, displayName: true } });
  const names = new Map(products.map((item) => [item.id, item.displayName]));
  const totals = aggregateRoundFacts(applications, round.goalSnapshot.targetAmount ? Number(round.goalSnapshot.targetAmount) : null);
  return { round: { id: round.id, status: round.status, startedAt: round.startedAt, completedAt: round.completedAt }, sessionEnded: Boolean(await prisma.applicationSession.findFirst({ where: { roundId, endedAt: { not: null } }, select: { id: true } })), ...totals, applications: applications.filter((item) => item.status !== 'SKIPPED').map((item) => ({ id: item.id, productName: names.get(item.productId) ?? 'Card application', status: item.status, outcome: item.outcome, approvedLimitKnown: item.approvedLimitKnown, approvedLimit: item.approvedLimit?.toString() ?? null, resultRecordedAt: item.resultRecordedAt, ...(consultant ? { issuerReason: item.issuerReason, version: item.version } : {}) })) };
}
