import { PrismaPg } from '@prisma/adapter-pg';
import { assertCreditDatabaseUrl } from '@credit/runtime';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrisma(databaseUrl: string) {
  const creditDatabaseUrl = assertCreditDatabaseUrl(databaseUrl);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: creditDatabaseUrl }) });
}
