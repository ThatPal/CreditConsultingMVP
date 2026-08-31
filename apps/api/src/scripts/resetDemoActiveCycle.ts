import { config } from 'dotenv';
import { createPrisma } from '../lib/prisma.js';

config({ path: '../../.env' });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error('Cycle reset is restricted to a local non-production database');
}

const prisma = createPrisma(url);

try {
  const user = await prisma.user.findUnique({
    where: { email: 'client@credit.local' },
    include: { client: true },
  });
  if (!user?.client) throw new Error('Demo client was not found');

  const activeCycle = await prisma.applicationCycle.findFirst({
    where: { clientId: user.client.id, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  if (!activeCycle) {
    console.log('No active cycle exists for client@credit.local');
  } else {
    await prisma.applicationCycle.delete({ where: { id: activeCycle.id } });
    console.log(`Removed active Cycle ${activeCycle.cycleNumber} for client@credit.local`);
  }
} finally {
  await prisma.$disconnect();
}
