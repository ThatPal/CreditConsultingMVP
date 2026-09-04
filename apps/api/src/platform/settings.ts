import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
export type GovernedSwitch =
  | 'commerce.purchases.enabled'
  | 'ai.processing.enabled'
  | 'notifications.email.enabled'
  | 'workflow.execution.enabled';
export async function governedSwitchEnabled(prisma: PrismaClient, key: GovernedSwitch) {
  const row = await prisma.platformSettingVersion.findFirst({
    where: { key, active: true },
    orderBy: { version: 'desc' },
    select: { value: true },
  });
  return row === null || row.value === true;
}
export async function requireGovernedSwitch(prisma: PrismaClient, key: GovernedSwitch) {
  if (!(await governedSwitchEnabled(prisma, key)))
    throw new AppError(
      'FEATURE_TEMPORARILY_DISABLED',
      503,
      'This operation is temporarily disabled by a governed safety control',
    );
}
