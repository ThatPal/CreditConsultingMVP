import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  await prisma.$queryRaw`SELECT 1`;
  const options = [
    [
      'PAYMENT_HISTORY_STRONG',
      'FINDING',
      'Payment history is strong',
      'On-time payment history supports the current profile.',
    ],
    [
      'UTILIZATION_CAUTION',
      'FINDING',
      'Utilization needs preparation',
      'Revolving utilization should be reduced before planned applications.',
    ],
    [
      'RECENT_INQUIRY_CAUTION',
      'FINDING',
      'Recent inquiry activity',
      'Recent inquiries should shape application timing and selection.',
    ],
    [
      'DEROGATORY_CRITICAL',
      'FINDING',
      'Derogatory item requires attention',
      'A negative item requires consultant review before new activity.',
    ],
    [
      'PROCEED_SELECTIVELY',
      'RECOMMENDATION',
      'Proceed selectively',
      'Consider a limited, carefully planned application strategy.',
    ],
    [
      'WAIT_NURTURE',
      'RECOMMENDATION',
      'Wait and nurture',
      'Delay new activity while completing profile-development actions.',
    ],
    [
      'UTILIZATION',
      'RATIONALE',
      'Utilization needs preparation',
      'Reduce revolving utilization before applying.',
    ],
    [
      'DOCUMENTS',
      'RATIONALE',
      'Documents incomplete',
      'Complete income and identity verification.',
    ],
    [
      'INQUIRIES',
      'RATIONALE',
      'Allow inquiries to age',
      'Wait for recent inquiries to move outside the selected timing band.',
    ],
    [
      'LOWER_UTILIZATION',
      'ACTION_BUNDLE',
      'Lower revolving utilization',
      'Adds the recommended utilization preparation steps.',
    ],
    [
      'COMPLETE_DOCUMENTS',
      'ACTION_BUNDLE',
      'Complete application documents',
      'Adds income and identity document requests.',
    ],
    [
      'REASSESS_30',
      'ACTION_BUNDLE',
      'Reassess readiness in 30 days',
      'Schedules a readiness reassessment after preparation.',
    ],
    [
      'USE_SELECTED_CARDS',
      'ACTION_BUNDLE',
      'Use selected cards strategically',
      'Use the consultant-selected cards for ordinary activity while protecting utilization.',
    ],
    [
      'ALLOW_INQUIRIES_TO_AGE',
      'ACTION_BUNDLE',
      'Allow inquiries to age',
      'Avoid new applications during the selected waiting period.',
    ],
    [
      'AVOID_NEW_APPLICATIONS',
      'ACTION_BUNDLE',
      'Pause new credit applications',
      'Do not submit additional applications until the consultant-selected date.',
    ],
    [
      'UPDATED_CREDIT_REPORT',
      'ACTION_BUNDLE',
      'Obtain an updated credit report',
      'Upload a new report after the preparation actions are complete.',
    ],
  ] as const;
  for (const [code, kind, label, description] of options) {
    await prisma.optionTemplate.upsert({
      where: { code_version: { code, version: 1 } },
      create: { code, kind, version: 1, label, description },
      update: { label, description, active: true },
    });
  }
  console.info(`Database seed completed with ${options.length} consultant options.`);
} finally {
  await prisma.$disconnect();
}
