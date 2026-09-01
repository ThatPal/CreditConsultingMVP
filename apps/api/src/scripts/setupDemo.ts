import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { hashPassword } from '../auth/security.js';
import { createPrisma } from '../lib/prisma.js';
import { createLocalDocumentStorage } from '../storage/documentStorage.js';
import { reconcileSupportAttention } from '../attention/attentionService.js';
import { resetReviewStaffMfa } from '../seeding/reviewMfaReset.js';

config({ path: '../../.env' });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error('Demo setup is restricted to a local non-production database');
}
const prisma = createPrisma(url);
const passwordHash = await hashPassword('DemoAccess2026!');

function makeReviewPdf() {
  const stream =
    'BT\n/F1 22 Tf\n72 700 Td\n(Credit Review Summary) Tj\n0 -36 Td\n/F1 12 Tf\n(Synthetic local review document.) Tj\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

try {
  const consultant = await prisma.user.upsert({
    where: { email: 'consultant@credit.local' },
    create: {
      email: 'consultant@credit.local',
      name: 'Casey Consultant',
      emailVerified: true,
      passwordHash,
      role: 'CONSULTANT',
      status: 'ACTIVE',
    },
    update: {
      name: 'Casey Consultant',
      emailVerified: true,
      passwordHash,
      role: 'CONSULTANT',
      status: 'ACTIVE',
      twoFactorEnabled: false,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@credit.local' },
    create: {
      email: 'admin@credit.local',
      name: 'Avery Administrator',
      emailVerified: true,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    update: {
      name: 'Avery Administrator',
      emailVerified: true,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      twoFactorEnabled: false,
    },
  });
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@credit.local' },
    create: {
      email: 'client@credit.local',
      name: 'Jordan Blake',
      emailVerified: true,
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    },
    update: {
      name: 'Jordan Blake',
      emailVerified: true,
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    },
  });
  for (const user of [consultant, admin, clientUser])
    await prisma.betterAuthAccount.upsert({
      where: { issuer_accountId: { issuer: 'local:credential', accountId: user.id } },
      create: {
        issuer: 'local:credential',
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: passwordHash,
      },
      update: { userId: user.id, providerId: 'credential', password: passwordHash },
    });
  if (process.env.RESET_REVIEW_STAFF_MFA === 'true')
    await resetReviewStaffMfa(prisma, [consultant.id, admin.id]);
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
  await prisma.staffClientAssignment.upsert({
    where: { staffUserId_clientId: { staffUserId: consultant.id, clientId: client.id } },
    create: { staffUserId: consultant.id, clientId: client.id },
    update: { deactivatedAt: null },
  });
  const seedBusiness = async (legalName: string, displayName: string, entityType: string) => {
    const existing = await prisma.clientBusiness.findFirst({
      where: { clientId: client.id, legalName },
    });
    return existing
      ? prisma.clientBusiness.update({
          where: { id: existing.id },
          data: { displayName, entityType, status: 'ACTIVE', archivedAt: null },
        })
      : prisma.clientBusiness.create({
          data: { clientId: client.id, legalName, displayName, entityType, status: 'ACTIVE' },
        });
  };
  const studio = await seedBusiness('Blake Strategy Studio LLC', 'Blake Strategy Studio', 'LLC');
  await seedBusiness('Jordan Blake Holdings Inc', 'Blake Holdings', 'CORPORATION');
  const seedRelationship = async (
    institutionName: string,
    relationshipType: 'CHECKING' | 'SAVINGS' | 'BUSINESS_BANKING',
    clientBusinessId: string | null,
    status: 'ACTIVE' | 'CLOSED',
  ) => {
    const existing = await prisma.clientFinancialRelationship.findFirst({
      where: { clientId: client.id, institutionName, relationshipType },
    });
    const data = {
      institutionName,
      relationshipType,
      clientBusinessId,
      approximateTenure: status === 'ACTIVE' ? 'About 3 years' : 'About 1 year',
      clientNote: 'High-level relationship context only.',
      status,
      closedAt: status === 'CLOSED' ? new Date(Date.now() - 31_536_000_000) : null,
    } as const;
    return existing
      ? prisma.clientFinancialRelationship.update({ where: { id: existing.id }, data })
      : prisma.clientFinancialRelationship.create({
          data: { clientId: client.id, source: 'CLIENT', ...data },
        });
  };
  await seedRelationship('Community Credit Union', 'CHECKING', null, 'ACTIVE');
  await seedRelationship('Regional Business Bank', 'BUSINESS_BANKING', studio.id, 'ACTIVE');
  await seedRelationship('Former Savings Institution', 'SAVINGS', null, 'CLOSED');
  for (let index = 1; index <= 24; index += 1) {
    const email = `client-directory-${String(index).padStart(2, '0')}@credit.local`;
    const directoryUser = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Synthetic Client ${index}`,
        emailVerified: true,
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'CLIENT' },
    });
    const directoryClient = await prisma.client.upsert({
      where: { userId: directoryUser.id },
      create: {
        userId: directoryUser.id,
        firstName: 'Synthetic',
        lastName: `Client ${String(index).padStart(2, '0')}`,
        termsAcceptedAt: new Date(),
        timezone: index % 2 ? 'America/New_York' : 'America/Chicago',
      },
      update: { status: 'ACTIVE' },
    });
    await prisma.staffClientAssignment.upsert({
      where: { staffUserId_clientId: { staffUserId: consultant.id, clientId: directoryClient.id } },
      create: { staffUserId: consultant.id, clientId: directoryClient.id },
      update: { deactivatedAt: null },
    });
    if (index === 2) {
      const existing = await prisma.clientBusiness.findFirst({
        where: { clientId: directoryClient.id, legalName: 'Synthetic One Business LLC' },
      });
      if (!existing)
        await prisma.clientBusiness.create({
          data: {
            clientId: directoryClient.id,
            legalName: 'Synthetic One Business LLC',
            displayName: 'One Business',
            entityType: 'LLC',
          },
        });
    }
  }
  const seededGoal = await prisma.clientGoal.upsert({
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
  await prisma.clientGoalRevision.upsert({
    where: { goalId_version: { goalId: seededGoal.id, version: seededGoal.version } },
    create: {
      goalId: seededGoal.id,
      clientId: client.id,
      version: seededGoal.version,
      goalType: seededGoal.goalType,
      scope: seededGoal.scope,
      targetAmount: seededGoal.targetAmount,
      allowAnnualFee: seededGoal.allowAnnualFee,
      priority: seededGoal.priority,
      status: seededGoal.status,
      changedById: clientUser.id,
      changeSource: 'DEMO_SEED',
    },
    update: {},
  });
  const seededIntakes = [
    { token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', expired: false },
    { token: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', expired: true },
  ];
  for (const scenario of seededIntakes) {
    await prisma.anonymousGoalIntake.upsert({
      where: { tokenHash: createHash('sha256').update(scenario.token).digest('hex') },
      create: {
        tokenHash: createHash('sha256').update(scenario.token).digest('hex'),
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: scenario.expired ? 35_000 : 80_000,
        allowAnnualFee: false,
        expiresAt: new Date(Date.now() + (scenario.expired ? -1 : 72) * 3_600_000),
      },
      update: {
        consumedAt: null,
        consumedByClientId: null,
        expiresAt: new Date(Date.now() + (scenario.expired ? -1 : 72) * 3_600_000),
      },
    });
  }
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
  const supportSubject = 'Question about my Credit Review next steps';
  const supportCase = await prisma.supportCase.findFirst({
    where: { clientId: client.id, subject: supportSubject },
  });
  if (!supportCase)
    await prisma.supportCase.create({
      data: {
        clientId: client.id,
        createdByUserId: clientUser.id,
        assignedToUserId: consultant.id,
        category: 'CREDIT_REVIEW',
        priority: 'HIGH',
        status: 'WAITING_ON_CLIENT',
        subject: supportSubject,
        messages: {
          create: [
            {
              authorUserId: clientUser.id,
              body: 'I uploaded my report. Is there anything else I should complete?',
            },
            {
              authorUserId: consultant.id,
              body: 'Your report is ready. Please confirm that the account list is current.',
            },
          ],
        },
      },
    });
  const queueScenarios = [
    ['Urgent identity verification blocked', 'URGENT', null, 'WAITING_ON_SUPPORT'],
    ['Document upload needs consultant review', 'HIGH', consultant.id, 'WAITING_ON_SUPPORT'],
    ['Application deadline question', 'URGENT', consultant.id, 'OPEN'],
    ['Billing clarification requested', 'NORMAL', null, 'WAITING_ON_SUPPORT'],
    ['Credit report account mismatch', 'HIGH', null, 'OPEN'],
    ['Business credit next-step question', 'NORMAL', consultant.id, 'WAITING_ON_SUPPORT'],
    ['Address history correction', 'NORMAL', null, 'WAITING_ON_SUPPORT'],
    ['Readiness review timing', 'NORMAL', consultant.id, 'OPEN'],
    ['Secured card recommendation question', 'HIGH', null, 'WAITING_ON_SUPPORT'],
    ['Loan application document question', 'HIGH', consultant.id, 'OPEN'],
    ['Profile update assistance', 'NORMAL', null, 'WAITING_ON_SUPPORT'],
    ['Dispute result follow-up', 'URGENT', null, 'OPEN'],
    ['Resolved demo history', 'NORMAL', consultant.id, 'RESOLVED'],
  ] as const;
  for (const [subject, priority, assignedToUserId, targetStatus] of queueScenarios) {
    let scenario = await prisma.supportCase.findFirst({ where: { clientId: client.id, subject } });
    scenario ??= await prisma.supportCase.create({
      data: {
        clientId: client.id,
        createdByUserId: clientUser.id,
        assignedToUserId,
        category: 'OTHER',
        priority,
        status: 'WAITING_ON_SUPPORT',
        subject,
        lastMessageAt: new Date(
          Date.now() - queueScenarios.findIndex((entry) => entry[0] === subject) * 3600000,
        ),
        messages: {
          create: { authorUserId: clientUser.id, body: `Seeded Work Queue scenario: ${subject}.` },
        },
      },
    });
    await reconcileSupportAttention(prisma, scenario);
    if (targetStatus === 'RESOLVED') {
      scenario = await prisma.supportCase.update({
        where: { id: scenario.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      await reconcileSupportAttention(prisma, scenario);
    }
  }
  await prisma.notification.upsert({
    where: {
      userId_semanticKey: {
        userId: clientUser.id,
        semanticKey: 'demo-review-ready',
      },
    },
    create: {
      userId: clientUser.id,
      clientId: client.id,
      semanticKey: 'demo-review-ready',
      type: 'REVIEW_STATUS',
      category: 'OPERATIONAL',
      title: 'Your Credit Review is ready for the next step',
      body: 'Confirm the account list and reply to your Consultant when ready.',
      link: '/app/support',
    },
    update: {
      readAt: null,
      seenAt: null,
      title: 'Your Credit Review is ready for the next step',
      body: 'Confirm the account list and reply to your Consultant when ready.',
      link: '/app/support',
    },
  });
  const documentType = await prisma.documentType.findUniqueOrThrow({
    where: { key: 'GENERAL_CLIENT_DOCUMENT' },
  });
  const documentStorage = createLocalDocumentStorage();
  const obsoleteDocumentKey = `documents/${client.id}/demo-review-summary.pdf`;
  await prisma.document.deleteMany({
    where: { storageProvider: 'LOCAL_DISK', storageKey: obsoleteDocumentKey },
  });
  await documentStorage.delete(obsoleteDocumentKey);
  const documentKey = `documents/${client.id}/demo-review-summary-v2.pdf`;
  let documentContent = await documentStorage.read(documentKey);
  if (!documentContent) {
    documentContent = makeReviewPdf();
    await documentStorage.put(documentKey, documentContent);
  }
  await prisma.document.upsert({
    where: {
      storageProvider_storageKey: { storageProvider: 'LOCAL_DISK', storageKey: documentKey },
    },
    create: {
      clientId: client.id,
      documentTypeId: documentType.id,
      originalFileName: 'Credit Review Summary.pdf',
      displayFileName: 'Credit Review Summary.pdf',
      mimeType: 'application/pdf',
      sizeBytes: documentContent.length,
      sha256: createHash('sha256').update(documentContent).digest('hex'),
      storageProvider: 'LOCAL_DISK',
      storageKey: documentKey,
      clientVisible: true,
      uploadedByUserId: consultant.id,
      retentionCategory: documentType.retentionCategory,
    },
    update: {
      status: 'AVAILABLE',
      clientVisible: true,
      sizeBytes: documentContent.length,
      sha256: createHash('sha256').update(documentContent).digest('hex'),
    },
  });
  const documentNames = [
    'Identity Verification',
    'Business Bank Statement',
    'Personal Bank Statement',
    'Credit Monitoring Export',
    'Address History',
    'Income Verification',
  ];
  for (let index = 1; index <= 24; index += 1) {
    const displayFileName = `${documentNames[(index - 1) % documentNames.length]} ${String(index).padStart(2, '0')}.pdf`;
    const storageKey = `documents/${client.id}/pm1-volume-${String(index).padStart(2, '0')}.pdf`;
    if (!(await documentStorage.read(storageKey)))
      await documentStorage.put(storageKey, documentContent);
    await prisma.document.upsert({
      where: {
        storageProvider_storageKey: { storageProvider: 'LOCAL_DISK', storageKey },
      },
      create: {
        clientId: client.id,
        documentTypeId: documentType.id,
        originalFileName: displayFileName,
        displayFileName,
        mimeType: 'application/pdf',
        sizeBytes: documentContent.length,
        sha256: createHash('sha256').update(documentContent).digest('hex'),
        storageProvider: 'LOCAL_DISK',
        storageKey,
        clientVisible: true,
        uploadedByUserId: index % 3 === 0 ? consultant.id : clientUser.id,
        retentionCategory: documentType.retentionCategory,
        uploadedAt: new Date(Date.now() - index * 86_400_000),
      },
      update: { displayFileName, status: index % 7 === 0 ? 'SUPERSEDED' : 'AVAILABLE' },
    });
  }
  for (let index = 1; index <= 30; index += 1) {
    await prisma.notification.upsert({
      where: {
        userId_semanticKey: {
          userId: clientUser.id,
          semanticKey: `pm1-volume-notification-${index}`,
        },
      },
      create: {
        userId: clientUser.id,
        clientId: client.id,
        semanticKey: `pm1-volume-notification-${index}`,
        type: index % 3 === 0 ? 'DOCUMENT' : 'SUPPORT_REPLY',
        category: 'OPERATIONAL',
        title: index % 3 === 0 ? `Document update ${index}` : `Support activity ${index}`,
        body: 'Seeded realistic-volume scenario for PM-1 manual product review.',
        link: index % 3 === 0 ? '/app/documents' : '/app/support',
        createdAt: new Date(Date.now() - index * 3_600_000),
        readAt: index % 4 === 0 ? new Date() : null,
      },
      update: {},
    });
  }
  console.info(
    JSON.stringify(
      {
        clientId: client.id,
        reviewId: review.id,
        accounts: ['client@credit.local', 'consultant@credit.local', 'admin@credit.local'],
        reviewVolume: {
          documents: 25,
          supportCases: queueScenarios.length + 1,
          notifications: 31,
          clientDirectory: 25,
        },
        clientContextScenarios: [
          'personal-only client',
          'one-business client',
          'multiple businesses',
          'active and closed financial relationships',
        ],
        goalScenarios: [
          'current client primary goal with revision history',
          'active anonymous goal intake',
          'expired anonymous goal intake',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
