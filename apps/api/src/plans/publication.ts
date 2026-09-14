import type { Prisma } from '../generated/prisma/client.js';

// Publication identity must never depend on editing, reconciliation or response timestamps.
// Legacy published versions may lack approval metadata; use immutable creation order last.
export const publishedVersionOrder: Prisma.PlanVersionOrderByWithRelationInput[] = [
  { approvedAt: { sort: 'desc', nulls: 'last' } },
  { activatedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
  { id: 'desc' },
];
