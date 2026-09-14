import type { PrismaClient } from '../generated/prisma/client.js';

type Work = {
  clientId: string;
  sourceType: string | null;
  sourceId: string | null;
  deepLink: unknown;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function resolvePlanWorkLinks<T extends Work>(prisma: PrismaClient, rows: T[]) {
  const planRows = rows.filter((row) => ['PlanItem', 'PlanVersion'].includes(row.sourceType ?? ''));
  if (!planRows.length) return rows;
  const clients = [...new Set(planRows.map((row) => row.clientId))];
  const ids = (type: string) => [
    ...new Set(
      planRows
        .filter((row) => row.sourceType === type && row.sourceId && uuid.test(row.sourceId))
        .map((row) => row.sourceId!),
    ),
  ];
  const [items, versions] = await Promise.all([
    prisma.planItem.findMany({
      where: { id: { in: ids('PlanItem') }, planVersion: { plan: { clientId: { in: clients } } } },
      select: {
        id: true,
        stableKey: true,
        planVersion: { select: { planId: true, plan: { select: { clientId: true } } } },
      },
    }),
    prisma.planVersion.findMany({
      where: { id: { in: ids('PlanVersion') }, plan: { clientId: { in: clients } } },
      select: { id: true, planId: true, plan: { select: { clientId: true } } },
    }),
  ]);
  return rows.map((row) => {
    if (!['PlanItem', 'PlanVersion'].includes(row.sourceType ?? '')) return row;
    const item =
      row.sourceType === 'PlanItem'
        ? items.find(
            (item) => item.id === row.sourceId && item.planVersion.plan.clientId === row.clientId,
          )
        : undefined;
    const version =
      row.sourceType === 'PlanVersion'
        ? versions.find(
            (version) => version.id === row.sourceId && version.plan.clientId === row.clientId,
          )
        : undefined;
    const planId = item?.planVersion.planId ?? version?.planId;
    return {
      ...row,
      navigationUnavailable: !planId,
      deepLink: planId
        ? {
            route: `/crm/clients/${row.clientId}/plan?planId=${planId}${item ? `&stepKey=${encodeURIComponent(item.stableKey)}` : ''}`,
          }
        : null,
    };
  });
}
