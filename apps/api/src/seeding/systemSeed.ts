import type { PrismaClient } from '../generated/prisma/client.js';

export const roleCapabilityPolicy = {
  CLIENT: ['client.read', 'review.read', 'support.read', 'document.read', 'document.manage'],
  CONSULTANT: [
    'client.read',
    'client.manage',
    'review.read',
    'review.publish',
    'support.read',
    'support.manage',
    'document.read',
    'document.manage',
  ],
  ADMIN: ['settings.manage', 'audit.read_platform', 'support.manage', 'document.read'],
} as const;

export const systemDocumentTypes = [
  {
    key: 'GENERAL_CLIENT_DOCUMENT',
    name: 'General document',
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
    maximumSizeBytes: 10 * 1024 * 1024,
    clientVisible: true,
    clientUploadEnabled: true,
    retentionCategory: 'CLIENT_RECORD',
    retentionDays: null,
  },
] as const;

export const systemNotificationTemplates = [
  {
    key: 'ACCOUNT_OPERATIONAL_UPDATE',
    version: 1,
    channel: 'IN_APP' as const,
    subject: null,
    body: 'An account update is available.',
  },
  {
    key: 'ACCOUNT_OPERATIONAL_UPDATE',
    version: 1,
    channel: 'EMAIL' as const,
    subject: 'Your Credit Strategy Platform account was updated',
    body: 'Sign in to view the latest account update.',
  },
] as const;

export const systemOptionTemplates = [
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
  ['DOCUMENTS', 'RATIONALE', 'Documents incomplete', 'Complete income and identity verification.'],
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

export async function seedSystemReferenceData(prisma: PrismaClient) {
  const capabilityRows = Object.entries(roleCapabilityPolicy).flatMap(([role, capabilities]) =>
    capabilities.map((capability) => ({
      role: role as 'CLIENT' | 'CONSULTANT' | 'ADMIN',
      capability,
    })),
  );
  await prisma.$transaction([
    ...systemOptionTemplates.map(([code, kind, label, description]) =>
      prisma.optionTemplate.upsert({
        where: { code_version: { code, version: 1 } },
        create: { code, kind, version: 1, label, description },
        update: { label, description, active: true },
      }),
    ),
    ...capabilityRows.map(({ role, capability }) =>
      prisma.roleCapability.upsert({
        where: { role_capability: { role, capability } },
        create: { role, capability },
        update: {},
      }),
    ),
    ...systemDocumentTypes.map((documentType) =>
      prisma.documentType.upsert({
        where: { key: documentType.key },
        create: {
          ...documentType,
          allowedMimeTypes: [...documentType.allowedMimeTypes],
          allowedExtensions: [...documentType.allowedExtensions],
        },
        update: {
          ...documentType,
          allowedMimeTypes: [...documentType.allowedMimeTypes],
          allowedExtensions: [...documentType.allowedExtensions],
          enabled: true,
        },
      }),
    ),
    ...systemNotificationTemplates.map((template) =>
      prisma.notificationTemplate.upsert({
        where: {
          key_version_channel: {
            key: template.key,
            version: template.version,
            channel: template.channel,
          },
        },
        create: template,
        update: { subject: template.subject, body: template.body, enabled: true },
      }),
    ),
    prisma.integration.upsert({
      where: { key: 'EMAIL_PRIMARY' },
      create: {
        key: 'EMAIL_PRIMARY',
        type: 'EMAIL',
        provider: 'CONFIGURED_EMAIL_PROVIDER',
        configurationMetadata: {
          supportedProviders: ['CONSOLE', 'SMTP', 'EXTERNAL'],
          smtpDeploymentOptions: ['GENERIC_SMTP', 'GOOGLE_WORKSPACE_RELAY'],
        },
        secretReferences: [],
      },
      update: {},
    }),
  ]);
  return {
    optionTemplates: systemOptionTemplates.length,
    roleCapabilities: capabilityRows.length,
    documentTypes: systemDocumentTypes.length,
    notificationTemplates: systemNotificationTemplates.length,
    integrations: 1,
  };
}
