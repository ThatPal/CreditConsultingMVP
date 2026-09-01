import type { PrismaClient } from '../generated/prisma/client.js';

export async function resetReviewStaffMfa(prisma: PrismaClient, userIds: string[]) {
  await prisma.$transaction([
    prisma.betterAuthSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.betterAuthTwoFactor.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { twoFactorEnabled: false },
    }),
  ]);
}
