import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

export async function preparePlanAttachments(
  tx: Prisma.TransactionClient,
  clientId: string,
  ids: string[],
) {
  if (ids.length > 5 || new Set(ids).size !== ids.length)
    throw new AppError('PLAN_ATTACHMENTS_INVALID', 422, 'Choose up to five different documents.');
  if (!ids.length) return [];
  // Stabilize file availability against replacement/deletion until the outcome commits.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Document" WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR SHARE`,
  );
  const documents = await tx.document.findMany({
    where: { id: { in: ids }, clientId, clientVisible: true, status: 'AVAILABLE' },
  });
  if (documents.length !== ids.length)
    throw new AppError(
      'PLAN_ATTACHMENT_UNAVAILABLE',
      422,
      'One or more selected documents are no longer available. Choose available files from your document library.',
    );
  return ids.map((id) => {
    const document = documents.find((document) => document.id === id)!;
    return {
      documentId: id,
      fileName: document.displayFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      sha256: document.sha256,
    };
  });
}
