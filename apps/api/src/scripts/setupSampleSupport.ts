import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createPrisma } from '../lib/prisma.js';

config({ path: resolve(process.cwd(), '.env') });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url))
  throw new Error('Sample support data is restricted to a local non-production database');

const prisma = createPrisma(url);

try {
  const clientUser = await prisma.user.findUnique({
    where: { email: 'client@credit.local' },
    include: { client: true },
  });
  if (!clientUser?.client) throw new Error('The local demo client account was not found');
  const consultant = clientUser.client.assignedConsultantId
    ? await prisma.user.findUnique({ where: { id: clientUser.client.assignedConsultantId } })
    : await prisma.user.findFirst({ where: { role: 'CONSULTANT', status: 'ACTIVE' } });
  if (!consultant) throw new Error('A local consultant account is required');

  const samples = [
    {
      subject: 'Unable to open an uploaded credit report',
      category: 'TECHNICAL' as const,
      priority: 'URGENT' as const,
      status: 'WAITING_ON_CLIENT' as const,
      daysAgo: 0,
      messages: [
        {
          authorUserId: clientUser.id,
          body: 'My newest credit report will not open from Documents.',
        },
        {
          authorUserId: consultant.id,
          body: 'I checked the report record. Please try opening it again and let me know whether the viewer now appears.',
        },
      ],
    },
    {
      subject: 'Question about my Credit Review next steps',
      category: 'CREDIT_REVIEW' as const,
      priority: 'HIGH' as const,
      status: 'WAITING_ON_SUPPORT' as const,
      daysAgo: 2,
      messages: [
        {
          authorUserId: clientUser.id,
          body: 'I uploaded my report. Is there anything else I should complete before the consultant review?',
        },
      ],
    },
    {
      subject: 'Update communication preferences',
      category: 'ACCOUNT' as const,
      priority: 'NORMAL' as const,
      status: 'RESOLVED' as const,
      daysAgo: 12,
      messages: [
        { authorUserId: clientUser.id, body: 'Please use email for routine account updates.' },
        {
          authorUserId: consultant.id,
          body: 'Your communication preference has been updated to email.',
        },
      ],
    },
  ];

  for (const sample of samples) {
    const existing = await prisma.supportCase.findFirst({
      where: { clientId: clientUser.client.id, subject: sample.subject },
    });
    if (existing) continue;
    const createdAt = new Date(Date.now() - sample.daysAgo * 86_400_000);
    await prisma.supportCase.create({
      data: {
        clientId: clientUser.client.id,
        createdByUserId: clientUser.id,
        assignedToUserId: consultant.id,
        category: sample.category,
        priority: sample.priority,
        status: sample.status,
        subject: sample.subject,
        createdAt,
        lastMessageAt: createdAt,
        resolvedAt: sample.status === 'RESOLVED' ? createdAt : null,
        messages: {
          create: sample.messages.map((message, index) => ({
            ...message,
            createdAt: new Date(createdAt.getTime() + index * 3_600_000),
          })),
        },
      },
    });
  }

  console.info(`Sample support requests are ready for ${clientUser.email}`);
} finally {
  await prisma.$disconnect();
}
