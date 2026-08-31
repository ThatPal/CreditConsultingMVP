import type {
  Prisma,
  PrismaClient,
  SupportCaseStatus,
  SupportCategory,
  SupportContextType,
} from '../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

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
