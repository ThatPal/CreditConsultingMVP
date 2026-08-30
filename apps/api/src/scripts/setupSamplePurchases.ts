import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../generated/prisma/client.js';

config({ path: resolve(process.cwd(), '.env') });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url))
  throw new Error('Sample purchase data is restricted to a local non-production database');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

try {
  const clientUser = await prisma.user.findUnique({
    where: { email: 'client@credit.local' },
    include: { client: true },
  });
  if (!clientUser?.client) throw new Error('The local demo client account was not found');

  const samples = [
    {
      serviceType: 'CREDIT_PROFILE_REVIEW' as const,
      amount: 295,
      status: 'PAID' as const,
      paymentReference: 'SAMPLE-HISTORY-REVIEW',
      purchasedAt: daysAgo(145),
    },
    {
      serviceType: 'CREDIT_CARD_ROUND' as const,
      amount: 695,
      status: 'PAID' as const,
      paymentReference: 'SAMPLE-HISTORY-APPLICATIONS',
      purchasedAt: daysAgo(82),
    },
    {
      serviceType: 'MAJOR_APPLICATION_READINESS' as const,
      amount: 395,
      status: 'REFUNDED' as const,
      paymentReference: 'SAMPLE-HISTORY-READINESS',
      purchasedAt: daysAgo(34),
    },
    {
      serviceType: 'CREDIT_PROFILE_REVIEW' as const,
      amount: 295,
      status: 'PENDING' as const,
      paymentReference: 'SAMPLE-HISTORY-PENDING',
      purchasedAt: null,
    },
  ];

  for (const sample of samples) {
    const existing = await prisma.servicePurchase.findFirst({
      where: { clientId: clientUser.client.id, paymentReference: sample.paymentReference },
    });
    if (!existing)
      await prisma.servicePurchase.create({
        data: {
          clientId: clientUser.client.id,
          ...sample,
          currency: 'USD',
          paymentProvider: 'MANUAL',
        },
      });
  }

  console.log(`Sample purchase history is ready for ${clientUser.email}`);
} finally {
  await prisma.$disconnect();
}
