import type { PrismaClient } from '../generated/prisma/client.js';
import { clientResponseForm } from './outcomes.js';

export async function listResponseDrafts(
  prisma: PrismaClient,
  clientId: string,
  actorId: string,
  before?: string,
) {
  // Immutable IDs keep pagination stable when a draft is edited or discarded.
  const records = await prisma.planResponseDraft.findMany({
    where: {
      actorId,
      ...(before ? { id: { lt: before } } : {}),
      item: {
        owner: 'CLIENT',
        planVersion: { status: { not: 'DRAFT' }, plan: { clientId } },
      },
    },
    orderBy: { id: 'desc' },
    take: 21,
    include: {
      item: {
        select: {
          clientTitle: true,
          clientBody: true,
          outcomeSchema: true,
          completionMode: true,
          planVersion: {
            select: { version: true, title: true, plan: { select: { title: true } } },
          },
        },
      },
    },
  });
  const rows = records.slice(0, 20);
  const files = await prisma.document.findMany({
    where: {
      id: { in: [...new Set(rows.flatMap((row) => row.documentIds))] },
      clientId,
      clientVisible: true,
      status: 'AVAILABLE',
    },
  });
  return {
    drafts: rows.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      revision: row.revision,
      version: row.item.planVersion.version,
      planTitle: row.item.planVersion.title ?? row.item.planVersion.plan.title,
      title: row.item.clientTitle,
      body: row.item.clientBody,
      responseForm: clientResponseForm(row.item.outcomeSchema, row.item.completionMode),
      values: row.values,
      note: row.note,
      help: row.help,
      updatedAt: row.updatedAt,
      files: files
        .filter((file) => row.documentIds.includes(file.id))
        .map((file) => ({
          documentId: file.id,
          fileName: file.displayFileName,
          sizeBytes: file.sizeBytes,
          status: file.status,
          available: true,
        })),
      unavailableFiles: row.documentIds.filter((id) => !files.some((file) => file.id === id))
        .length,
    })),
    nextBefore: records.length > 20 ? rows.at(-1)!.id : null,
  };
}
