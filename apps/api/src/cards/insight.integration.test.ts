import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { approveInsight, listCatalog, prepareInsight, publishOffer } from './service.js';

describe('governed CardInsight preparation and approval', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(url);
  const marker = randomUUID();
  let actorId = '';
  let issuerId = '';
  let productId = '';
  let insightId = '';
  beforeAll(async () => {
    await prisma.$connect();
    actorId = (await prisma.user.create({ data: { email: `insight-${marker}@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } })).id;
    issuerId = (await prisma.cardIssuer.create({ data: { slug: `insight-issuer-${marker}`, name: 'Insight issuer', aliases: [] } })).id;
    productId = (await prisma.cardProduct.create({ data: { issuerId, slug: `insight-card-${marker}`, canonicalName: `Insight ${marker}`, displayName: 'Insight card', aliases: [], audience: 'PERSONAL', portfolioType: 'PERSONAL_CREDIT', features: [], tags: [] } })).id;
    await prisma.aIProcessDefinition.create({ data: { processKey: `card-insight-${marker}`, processVersion: 1, modelProfile: 'configured-test-profile', inputSchemaVersion: 1, outputSchemaVersion: 1, instructionVersion: 'test-v1', retryPolicy: { maxAttempts: 1 }, dataClassification: 'INTERNAL_CATALOG', allowedContext: { offerFacts: true }, domainConsumer: 'CARD_INSIGHT' } });
    await publishOffer(prisma, { productId, actorId, facts: { annualFee: 0 }, sourceEvidence: { reviewed: true }, eventKey: `insight-offer:${marker}:1` });
  });
  afterAll(async () => {
    await prisma.cardProduct.update({ where: { id: productId }, data: { currentInsightVersionId: null, currentOfferVersionId: null } });
    await prisma.cardInsightVersion.deleteMany({ where: { productId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: productId } });
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    await prisma.cardOfferVersion.deleteMany({ where: { productId } });
    await prisma.cardProduct.delete({ where: { id: productId } });
    await prisma.cardIssuer.delete({ where: { id: issuerId } });
    await prisma.aIProcessDefinition.deleteMany({ where: { processKey: `card-insight-${marker}` } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('AI provenance persists but never auto-approves or leaks through client projection', async () => {
    const insight = await prepareInsight(prisma, { productId, actorId, summary: 'Client-safe summary', rationale: 'Internal reasoning', strengths: ['Stable fee'], cautions: ['Terms change'], confidence: 'MEDIUM', evidence: [{ field: 'annualFee' }], ai: { processKey: `card-insight-${marker}`, processVersion: 1, modelProvenance: { provider: 'configured', model: 'test' }, proposedPayload: { rawReasoning: 'private' } } });
    insightId = insight.id;
    expect(insight.status).toBe('IN_REVIEW');
    expect(insight.processDefinitionId).toBeTruthy();
    const beforeApproval = (await listCatalog(prisma, { search: marker }))[0]!;
    expect(beforeApproval.currentInsightVersion).toBeNull();
    expect(JSON.stringify(beforeApproval)).not.toMatch(/Internal reasoning|rawReasoning|configured/);
  });

  test('human approval is idempotent and material offer change stales immutable history', async () => {
    await approveInsight(prisma, { insightId, actorId, note: 'Professional review complete', idempotencyKey: `approve-${marker}` });
    await approveInsight(prisma, { insightId, actorId, note: 'retry', idempotencyKey: `approve-${marker}` });
    expect(await prisma.auditEvent.count({ where: { actorId, action: 'CARD_INSIGHT_APPROVED', entityId: insightId } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { eventKey: `card-insight-approved:approve-${marker}` } })).toBe(1);
    expect((await listCatalog(prisma, { search: marker }))[0]?.currentInsightVersion?.clientSafeSummary).toBe('Client-safe summary');
    await publishOffer(prisma, { productId, actorId, facts: { annualFee: 95 }, sourceEvidence: { reviewed: true }, eventKey: `insight-offer:${marker}:2` });
    const historical = await prisma.cardInsightVersion.findUniqueOrThrow({ where: { id: insightId } });
    expect(historical.status).toBe('STALE');
    expect(historical.clientSafeSummary).toBe('Client-safe summary');
    expect((await prisma.cardProduct.findUniqueOrThrow({ where: { id: productId } })).currentInsightVersionId).toBeNull();
  });
});
