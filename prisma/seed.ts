import { PrismaPg } from '@prisma/adapter-pg';
import { assertCreditDatabaseUrl } from '@credit/runtime';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';
import { seedSystemReferenceData } from '../apps/api/src/seeding/systemSeed.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: assertCreditDatabaseUrl(url) }),
});

try {
  await prisma.$queryRaw`SELECT 1`;
  const result = await seedSystemReferenceData(prisma);
  console.info(`Canonical system seed completed with ${result.optionTemplates} option templates.`);
} finally {
  await prisma.$disconnect();
}
