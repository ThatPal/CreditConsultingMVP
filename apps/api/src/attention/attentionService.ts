import { Prisma, type PrismaClient, type SupportCaseStatus } from '../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const actionableAttentionStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING'] as const;

export function isActionableAttentionStatus(status: string) {
  return actionableAttentionStatuses.includes(
    status as (typeof actionableAttentionStatuses)[number],
  );
}

export function supportNeedsAttention(status: SupportCaseStatus) {
  return status === 'OPEN' || status === 'WAITING_ON_SUPPORT';
}

export function supportAttentionDeepLink(supportCaseId: string) {
  return { type: 'SUPPORT_CASE', route: '/crm/support', params: { caseId: supportCaseId } };
}

export async function reconcileSupportAttention(
  db: Db,
  input: {
    id: string;
    clientId: string;
    assignedToUserId: string | null;
    subject: string;
    priority: 'NORMAL' | 'HIGH' | 'URGENT';
    status: SupportCaseStatus;
    lastMessageAt: Date;
  },
) {
  const dedupeKey = `SUPPORT_CASE:${input.id}:REPLY_NEEDED`;
  const existing = await db.workItem.findFirst({
    where: { dedupeKey, status: { in: [...actionableAttentionStatuses] } },
    orderBy: { id: 'asc' },
  });
  if (!supportNeedsAttention(input.status)) {
    if (!existing) return null;
    return db.workItem.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        resolvedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }
  const dueHours = input.priority === 'URGENT' ? 4 : input.priority === 'HIGH' ? 24 : 48;
  const data = {
    clientId: input.clientId,
    domain: 'SUPPORT',
    title: `Support reply needed: ${input.subject}`,
    priority: input.priority,
    suggestedNextAction: 'Review the request and respond to the client',
    dueAt: new Date(input.lastMessageAt.getTime() + dueHours * 60 * 60 * 1000),
    authority: 'ATTENTION_PROJECTION' as const,
    sourceType: 'SUPPORT_CASE',
    sourceId: input.id,
    reasonCode: 'CLIENT_REPLY_NEEDED',
    dedupeKey,
    deepLink: supportAttentionDeepLink(input.id),
    neededSince: input.lastMessageAt,
  };
  if (existing)
    return db.workItem.update({
      where: { id: existing.id },
      data: { ...data, version: { increment: 1 } },
    });
  return db.workItem.create({ data: { ...data, assigneeId: input.assignedToUserId } });
}

export function workQueueOrderBy() {
  return [
    { priority: 'desc' as const },
    { dueAt: { sort: 'asc' as const, nulls: 'last' as const } },
    { neededSince: 'asc' as const },
    { id: 'asc' as const },
  ];
}

export function attentionClaimDecision(
  item: { assigneeId: string | null; version: number; status: string },
  actorId: string,
  expectedVersion: number,
) {
  if (!isActionableAttentionStatus(item.status)) return 'NON_ACTIONABLE' as const;
  if (item.version !== expectedVersion) return 'STALE' as const;
  if (item.assigneeId === actorId) return 'REPLAY' as const;
  if (item.assigneeId) return 'STALE' as const;
  return 'CLAIM' as const;
}

export async function recordAttentionClaimConflict(
  db: Db,
  input: {
    clientId: string;
    actorId: string;
    workItemId: string;
    category: 'NON_ACTIONABLE' | 'STALE_VERSION' | 'ALREADY_CLAIMED' | 'CONCURRENT_CLAIM';
  },
) {
  return db.auditEvent.create({
    data: {
      clientId: input.clientId,
      actorId: input.actorId,
      action: 'ATTENTION_ITEM_CLAIM_CONFLICT',
      entityType: 'WorkItem',
      entityId: input.workItemId,
      metadata: { category: input.category },
    },
  });
}
