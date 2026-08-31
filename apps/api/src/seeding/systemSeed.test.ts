import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { seedSystemReferenceData, systemOptionTemplates } from './systemSeed.js';

let prisma: PrismaClient;
const codes = systemOptionTemplates.map(([code]) => code);

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for seed tests');
  prisma = createPrisma(process.env.DATABASE_URL);
  await prisma.$connect();
});
afterAll(async () => prisma.$disconnect());

describe('canonical system seed', () => {
  test('is deterministic and idempotent across repeated runs', async () => {
    const first = await seedSystemReferenceData(prisma);
    const second = await seedSystemReferenceData(prisma);
    const count = await prisma.optionTemplate.count({ where: { code: { in: codes }, version: 1 } });
    expect(first).toEqual({ optionTemplates: systemOptionTemplates.length });
    expect(second).toEqual(first);
    expect(count).toBe(systemOptionTemplates.length);
  });
});
