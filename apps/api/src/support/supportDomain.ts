import type {
  Prisma,
  PrismaClient,
  SupportCaseStatus,
  SupportCategory,
  SupportContextType,
} from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const SUPPORT_AUTHORITY_DENYLIST = [
  'review.mutate',
  'profile.mutate',
  'strategy.mutate',
  'round.finalize',
  'major-readiness.decide',
  'payment.mutate',
  'entitlement.mutate',
  'security.mutate',
] as const;

const supportQueues: Record<SupportCategory, string> = {
  ACCOUNT: 'ACCOUNT_ACCESS',
  BILLING: 'COMMERCE',
  CREDIT_REVIEW: 'CREDIT_REVIEW',
  DOCUMENTS: 'DOCUMENTS',
  APPLICATION_ROUND: 'APPLICATIONS',
  MAJOR_READINESS: 'MAJOR_READINESS',
  TECHNICAL: 'TECHNICAL',
  OTHER: 'GENERAL',
};

export function routeSupportCase(input: {
  category: SupportCategory;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt?: Date;
  assignedConsultantId?: string | null;
}) {
  const createdAt = input.createdAt ?? new Date();
  const slaHours = input.priority === 'URGENT' ? 2 : input.priority === 'HIGH' ? 8 : 24;
  return {
    queue: supportQueues[input.category],
    assigneeId: input.assignedConsultantId ?? null,
    slaDueAt: new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000),
    reason: input.assignedConsultantId ? 'CLIENT_RELATIONSHIP' : 'QUEUE_FALLBACK',
  };
}

export function supportContextLink(type: SupportContextType, resourceId: string | null) {
  if (!resourceId || type === 'GENERAL') return null;
  const links: Partial<Record<SupportContextType, string>> = {
    DOCUMENT: '/app/documents',
    REVIEW: `/app/credit-center/reviews/${resourceId}`,
    PLAN: '/app/plan',
    CARD: '/app/cards',
    APPLICATION_ROUND: `/app/rounds/${resourceId}`,
    STRATEGY: `/app/rounds/${resourceId}/strategy`,
    APPOINTMENT: '/app/appointments',
    APPLICATION_SESSION: `/app/application-sessions/${resourceId}`,
    POST_ROUND: `/app/rounds/${resourceId}/follow-up`,
    MAJOR_READINESS: '/app/major-readiness',
  };
  return links[type] ?? null;
}

export const supportTransitions: Record<SupportCaseStatus, readonly SupportCaseStatus[]> = {
  OPEN: ['WAITING_ON_SUPPORT', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED'],
  WAITING_ON_SUPPORT: ['WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED'],
  WAITING_ON_CLIENT: ['WAITING_ON_SUPPORT', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function assertSupportTransition(from: SupportCaseStatus, to: SupportCaseStatus) {
  if (from === to) return;
  if (!supportTransitions[from].includes(to)) throw new Error('INVALID_SUPPORT_TRANSITION');
}

export type SupportReplyKind = 'CLIENT_VISIBLE_REPLY' | 'CONSULTANT_VISIBLE_REPLY';

export function supportReplyTransition(
  from: SupportCaseStatus,
  kind: SupportReplyKind,
): SupportCaseStatus {
  if (from === 'CLOSED') throw new Error('SUPPORT_CASE_CLOSED');
  if (from === 'RESOLVED') throw new Error('SUPPORT_CASE_RESOLVED');
  const to = kind === 'CLIENT_VISIBLE_REPLY' ? 'WAITING_ON_SUPPORT' : 'WAITING_ON_CLIENT';
  assertSupportTransition(from, to);
  return to;
}

export async function authorizedSupportClientIds(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  principal: AuthPrincipal,
  at = new Date(),
) {
  if (principal.role !== 'CONSULTANT') return [];
  const candidates = await prisma.supportCase.findMany({
    distinct: ['clientId'],
    select: { clientId: true },
  });
  const decisions = await Promise.all(
    candidates.map(async ({ clientId }) => ({
      clientId,
      allowed: await authorization.authorize(
        principal,
        'support.manage',
        { type: 'client', clientId },
        { at },
      ),
    })),
  );
  return decisions.filter(({ allowed }) => allowed).map(({ clientId }) => clientId);
}

export async function resolveSupportContext(
  db: Db,
  input: {
    clientId: string;
    category: SupportCategory;
    contextType?: SupportContextType;
    contextResourceId?: string | null;
  },
) {
  const contextType = input.contextType ?? 'GENERAL';
  const category = await db.supportCategoryDefinition.findFirst({
    where: {
      key: input.category,
      enabled: true,
      allowedContextTypes: { has: contextType },
    },
    select: { key: true, name: true, clientVisible: true },
  });
  if (!category || !category.clientVisible) throw new Error('SUPPORT_CATEGORY_UNAVAILABLE');
  if (contextType === 'GENERAL') {
    if (input.contextResourceId) throw new Error('SUPPORT_CONTEXT_INVALID');
    return { type: 'GENERAL' as const, resourceId: null, summary: 'General support request' };
  }
  if (!input.contextResourceId) throw new Error('SUPPORT_CONTEXT_INVALID');
  if (contextType === 'DOCUMENT') {
    const document = await db.document.findFirst({
      where: {
        id: input.contextResourceId,
        clientId: input.clientId,
        status: 'AVAILABLE',
        clientVisible: true,
      },
      select: { id: true, displayFileName: true, documentType: { select: { name: true } } },
    });
    if (!document) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return {
      type: contextType,
      resourceId: document.id,
      summary: `${document.documentType.name}: ${document.displayFileName}`,
    };
  }
  if (contextType === 'REVIEW') {
    const review = await db.creditReview.findFirst({
      where: { id: input.contextResourceId, clientId: input.clientId },
      select: { id: true, status: true },
    });
    if (!review) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return {
      type: contextType,
      resourceId: review.id,
      summary: `Credit Review · ${review.status}`,
    };
  }
  if (contextType === 'PLAN') {
    const plan = await db.plan.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, status: true } });
    if (!plan) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: plan.id, summary: `Credit plan · ${plan.status}` };
  }
  if (contextType === 'CARD') {
    const card = await db.clientCard.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, cardName: true, accountStatus: true } });
    if (!card) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: card.id, summary: `${card.cardName} · ${card.accountStatus ?? 'Status unavailable'}` };
  }
  if (contextType === 'APPLICATION_ROUND') {
    const round = await db.creditCardRound.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, status: true } });
    if (!round) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: round.id, summary: `Application round · ${round.status}` };
  }
  if (contextType === 'STRATEGY') {
    const strategy = await db.roundStrategy.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, roundId: true, status: true } });
    if (!strategy) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: strategy.roundId, summary: `Application strategy · ${strategy.status}` };
  }
  if (contextType === 'APPOINTMENT') {
    const appointment = await db.appointment.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, status: true, startsAt: true } });
    if (!appointment) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: appointment.id, summary: `Appointment · ${appointment.status} · ${appointment.startsAt.toISOString()}` };
  }
  if (contextType === 'POST_ROUND') {
    const followUp = await db.postRoundFollowUp.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, roundId: true, status: true } });
    if (!followUp) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: followUp.roundId, summary: `Post-round follow-up · ${followUp.status}` };
  }
  if (contextType === 'MAJOR_READINESS') {
    const major = await db.majorReadinessCase.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, status: true } });
    if (!major) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: major.id, summary: `Major readiness · ${major.status}` };
  }
  if (contextType === 'APPLICATION_SESSION') {
    const session = await db.applicationSession.findFirst({ where: { id: input.contextResourceId, clientId: input.clientId }, select: { id: true, status: true } });
    if (!session) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
    return { type: contextType, resourceId: session.id, summary: `Live application session · ${session.status}` };
  }
  const cycle = await db.applicationCycle.findFirst({
    where: { id: input.contextResourceId, clientId: input.clientId },
    select: { id: true, displayName: true, status: true },
  });
  if (!cycle) throw new Error('SUPPORT_CONTEXT_NOT_FOUND');
  return {
    type: contextType,
    resourceId: cycle.id,
    summary: `${cycle.displayName ?? 'Application cycle'} · ${cycle.status}`,
  };
}

export async function resolveSupportAttachments(db: Db, clientId: string, documentIds: string[]) {
  const uniqueIds = [...new Set(documentIds)];
  if (uniqueIds.length > 5) throw new Error('TOO_MANY_SUPPORT_ATTACHMENTS');
  if (!uniqueIds.length) return [];
  const documents = await db.document.findMany({
    where: { id: { in: uniqueIds }, clientId, status: 'AVAILABLE', clientVisible: true },
    select: { id: true, displayFileName: true, mimeType: true, sizeBytes: true },
  });
  if (documents.length !== uniqueIds.length) throw new Error('SUPPORT_ATTACHMENT_NOT_FOUND');
  return uniqueIds.map((id) => documents.find((document) => document.id === id)!);
}

export const supportAttachmentProjection = {
  id: true,
  createdAt: true,
  document: {
    select: { id: true, displayFileName: true, mimeType: true, sizeBytes: true, status: true },
  },
} as const;
