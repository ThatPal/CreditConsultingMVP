import { config } from 'dotenv';
import { hashPassword } from '../auth/security.js';
import { createPrisma } from '../lib/prisma.js';

config({ path: '../../.env' });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error('Demo setup is restricted to a local non-production database');
}
const prisma = createPrisma(url);
const passwordHash = await hashPassword('DemoAccess2026!');

try {
  const consultant = await prisma.user.upsert({
    where: { email: 'consultant@credit.local' },
    create: {
      email: 'consultant@credit.local',
      passwordHash,
      role: 'CONSULTANT',
      status: 'ACTIVE',
    },
    update: { passwordHash, role: 'CONSULTANT', status: 'ACTIVE' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@credit.local' },
    create: { email: 'admin@credit.local', passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@credit.local' },
    create: { email: 'client@credit.local', passwordHash, role: 'CLIENT', status: 'ACTIVE' },
    update: { passwordHash, role: 'CLIENT', status: 'ACTIVE' },
  });
  const client = await prisma.client.upsert({
    where: { userId: clientUser.id },
    create: {
      userId: clientUser.id,
      firstName: 'Jordan',
      lastName: 'Blake',
      assignedConsultantId: consultant.id,
      termsAcceptedAt: new Date(),
      timezone: 'America/New_York',
    },
    update: { assignedConsultantId: consultant.id, status: 'ACTIVE' },
  });
  await prisma.clientGoal.upsert({
    where: {
      clientId_goalType_scope: { clientId: client.id, goalType: 'ZERO_APR_CREDIT', scope: 'BOTH' },
    },
    create: {
      clientId: client.id,
      goalType: 'ZERO_APR_CREDIT',
      scope: 'BOTH',
      targetAmount: 100000,
      currentAmount: 62000,
      priority: 'PRIMARY',
    },
    update: { targetAmount: 100000, currentAmount: 62000, priority: 'PRIMARY', status: 'ACTIVE' },
  });
  let purchase = await prisma.servicePurchase.findFirst({
    where: {
      clientId: client.id,
      serviceType: 'CREDIT_PROFILE_REVIEW',
      paymentReference: 'DEMO-REVIEW-001',
    },
  });
  purchase ??= await prisma.servicePurchase.create({
    data: {
      clientId: client.id,
      serviceType: 'CREDIT_PROFILE_REVIEW',
      amount: 0,
      status: 'PAID',
      paymentProvider: 'MANUAL',
      paymentReference: 'DEMO-REVIEW-001',
      purchasedAt: new Date(),
    },
  });
  let review = await prisma.creditReview.findFirst({
    where: { clientId: client.id, purchaseId: purchase.id },
  });
  review ??= await prisma.creditReview.create({
    data: {
      clientId: client.id,
      purchaseId: purchase.id,
      status: 'INFORMATION_RECEIVED',
      generalReadiness: 'UNDER_REVIEW',
      submittedAt: new Date(),
      intake: {
        create: {
          reportDocumentKey: 'demo/credit-report.pdf',
          reportSource: 'Experian',
          reportDate: new Date(),
          materialChanges: ['Balance changed', 'No new accounts'],
          clientConfirmedAt: new Date(),
          submittedAt: new Date(),
        },
      },
    },
  });
  const existingWork = await prisma.workItem.findFirst({
    where: {
      clientId: client.id,
      domain: 'CREDIT_REVIEW',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });
  if (!existingWork)
    await prisma.workItem.create({
      data: {
        clientId: client.id,
        assigneeId: consultant.id,
        title: 'Review submitted Credit Profile',
        domain: 'CREDIT_REVIEW',
        priority: 'HIGH',
        suggestedNextAction: 'Open guided Review workspace',
        dueAt: new Date(Date.now() + 86400000),
      },
    });
  console.info(
    JSON.stringify(
      {
        clientId: client.id,
        reviewId: review.id,
        accounts: ['client@credit.local', 'consultant@credit.local', 'admin@credit.local'],
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
