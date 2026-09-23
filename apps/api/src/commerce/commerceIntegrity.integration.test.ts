import { beforeEach, afterAll, expect, test } from 'vitest';
import request from 'supertest';
import { createPrisma } from '../lib/prisma.js';
import { integrityFixture } from './commerceIntegrity.fixture.js';
import {
  canonicalDefaultGateway,
  setDefaultGateway,
  setGatewayEnabled,
} from './paymentOperations.js';
const url = process.env.DATABASE_URL ?? '';
if (new URL(url).pathname !== '/credit_strategy_rec02_com01a')
  throw new Error('Disposable credit_strategy_rec02_com01a database required');
const prisma = createPrisma(url);
let f: Awaited<ReturnType<typeof integrityFixture>>;
beforeEach(async () => {
  f = await integrityFixture(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});
test('R1 operator metadata survives runtime, list and connection refresh; capability ownership survives edits', async () => {
  const metadata = { displayName: 'Synthetic operator label', accountReference: 'reference-only' };
  const save = await request(f.app(f.admin))
    .patch('/api/v1/admin/payment-gateways/PAYPAL')
    .send(metadata)
    .expect(200);
  expect(save.body.gateway.configurationMetadata).toMatchObject({
    ...metadata,
    capabilities: f.a.capabilities,
  });
  f.a.capabilities = { ...f.a.capabilities, statusRetrieval: true };
  await canonicalDefaultGateway(prisma, f.registry);
  const list = await request(f.app(f.admin)).get('/api/v1/admin/payment-gateways').expect(200);
  expect(
    list.body.gateways.find((g: { provider: string }) => g.provider === 'PAYPAL')
      .configurationMetadata,
  ).toEqual({ ...metadata, capabilities: f.a.capabilities });
  await request(f.app(f.admin)).post('/api/v1/admin/integrations/paypal/test').send({}).expect(200);
  const stored = await prisma.paymentGatewayConfig.findUniqueOrThrow({
    where: { provider: 'PAYPAL' },
  });
  expect(stored.configurationMetadata).toEqual({ ...metadata, capabilities: f.a.capabilities });
  expect(stored.version).toBe(save.body.gateway.version + 1);
  expect(stored.defaultForCheckout).toBe(true);
  expect(stored.lastTestedAt).not.toBeNull();
  expect(
    await prisma.auditEvent.count({
      where: { actorId: f.admin.userId, action: 'PAYMENT_GATEWAY_CONFIGURATION_UPDATED' },
    }),
  ).toBe(1);
  expect(
    await prisma.auditEvent.count({
      where: { actorId: f.admin.userId, action: 'PAYMENT_GATEWAY_CONNECTION_TESTED' },
    }),
  ).toBe(1);
});
test('R1 denied client, staff capability and step-up writes leave configuration intact', async () => {
  const before = await prisma.paymentGatewayConfig.findUniqueOrThrow({
    where: { provider: 'PAYPAL' },
  });
  for (const app of [
    f.app(f.client),
    f.app(f.admin, false),
    f.app({ ...f.admin, stepUpVerified: false }),
  ]) {
    const response = await request(app)
      .patch('/api/v1/admin/payment-gateways/PAYPAL')
      .send({ displayName: 'Denied' });
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  expect(
    await prisma.paymentGatewayConfig.findUniqueOrThrow({ where: { provider: 'PAYPAL' } }),
  ).toEqual(before);
});
test('R1 ordinary refresh retains saved fields while updating observed health', async () => {
  await request(f.app(f.admin))
    .patch('/api/v1/admin/payment-gateways/PAYPAL')
    .send({ displayName: 'Refresh proof', accountReference: 'Synthetic reference' })
    .expect(200);
  const before = await prisma.paymentGatewayConfig.findUniqueOrThrow({
    where: { provider: 'PAYPAL' },
  });
  f.a.healthy = false;
  await request(f.app(f.admin)).get('/api/v1/admin/payment-gateways').expect(200);
  const after = await prisma.paymentGatewayConfig.findUniqueOrThrow({
    where: { provider: 'PAYPAL' },
  });
  expect(after.configurationMetadata).toMatchObject({
    displayName: 'Refresh proof',
    accountReference: 'Synthetic reference',
  });
  expect(after.status).toBe('DEGRADED');
  expect(after.connected).toBe(false);
  expect(after.version).toBe(before.version);
  expect(after.enabledForNewPayments).toBe(before.enabledForNewPayments);
  f.a.healthy = true;
});
test('R2 failed A checkout replays A after persisted default switches to B; new requests use B', async () => {
  await setDefaultGateway(prisma, 'PAYPAL', f.admin.userId);
  f.a.fail = true;
  const body = { productId: f.product.id };
  const key = 'switch-default';
  await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(503);
  const original = await prisma.payment.findFirstOrThrow({
    where: { clientId: f.client.clientId! },
    include: { purchase: true },
  });
  await setDefaultGateway(prisma, 'STRIPE', f.admin.userId);
  f.a.fail = false;
  const replay = await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(200);
  expect(f.b.calls).toHaveLength(0);
  expect(f.a.calls).toHaveLength(2);
  expect(replay.body.purchaseId).toBe(original.purchaseId);
  expect(replay.body.payment.id).toBe(original.id);
  const persisted = await prisma.payment.findUniqueOrThrow({
    where: { id: original.id },
    include: { purchase: true },
  });
  expect([
    persisted.provider,
    persisted.providerEnvironment,
    persisted.amount.toString(),
    persisted.currency,
    persisted.purchase.termsSnapshot,
    persisted.purchase.productVersionId,
  ]).toEqual([
    original.provider,
    original.providerEnvironment,
    original.amount.toString(),
    original.currency,
    original.purchase.termsSnapshot,
    original.purchase.productVersionId,
  ]);
  expect(await prisma.payment.count({ where: { purchaseId: original.purchaseId } })).toBe(1);
  expect(
    await prisma.serviceEntitlement.count({ where: { purchaseId: original.purchaseId } }),
  ).toBe(0);
  expect(
    await prisma.reviewCreditTransaction.count({ where: { purchaseId: original.purchaseId } }),
  ).toBe(0);
  await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', 'new-under-b')
    .send(body)
    .expect(201);
  expect(f.b.calls).toHaveLength(1);
  const stable = await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(200);
  expect(stable.body.payment.id).toBe(original.id);
  expect(f.a.calls).toHaveLength(2);
});
test('R2 unavailable, disabled and changed-environment A cannot fall back to B', async () => {
  for (const mode of ['unhealthy', 'disabled', 'environment'] as const) {
    f.a.healthy = true;
    f.a.environment = 'SANDBOX';
    await setGatewayEnabled(prisma, 'PAYPAL', true, f.admin.userId);
    await setDefaultGateway(prisma, 'PAYPAL', f.admin.userId);
    f.a.fail = true;
    const key = `blocked-${mode}`;
    const body = { productId: f.product.id };
    await request(f.app())
      .post('/api/v1/client/checkouts')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(503);
    f.a.fail = false;
    await setDefaultGateway(prisma, 'STRIPE', f.admin.userId);
    if (mode === 'unhealthy') f.a.healthy = false;
    if (mode === 'disabled') await setGatewayEnabled(prisma, 'PAYPAL', false, f.admin.userId);
    if (mode === 'environment') f.a.environment = 'DIFFERENT_SANDBOX';
    const before = [f.a.calls.length, f.b.calls.length];
    const result = await request(f.app())
      .post('/api/v1/client/checkouts')
      .set('Idempotency-Key', key)
      .send(body);
    expect(result.status).toBe(503);
    expect([f.a.calls.length, f.b.calls.length]).toEqual(before);
    const pending = await prisma.payment.findMany({ where: { clientId: f.client.clientId! } });
    expect(
      pending.every((payment) => payment.state === 'PENDING' && payment.providerOrderId === null),
    ).toBe(true);
    expect(await prisma.serviceEntitlement.count({ where: { clientId: f.client.clientId! } })).toBe(
      0,
    );
    expect(
      await prisma.reviewCreditTransaction.count({ where: { clientId: f.client.clientId! } }),
    ).toBe(0);
  }
  f.a.healthy = true;
  f.a.environment = 'SANDBOX';
});
test('R2 replay uses frozen product version, rejects different product and isolates another client', async () => {
  const key = 'frozen-terms';
  const body = { productId: f.product.id };
  await setDefaultGateway(prisma, 'STRIPE', f.admin.userId);
  const first = await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(201);
  await prisma.serviceProduct.update({ where: { id: f.product.id }, data: { active: false } });
  const replay = await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(200);
  expect(replay.body.payment).toEqual(first.body.payment);
  await request(f.app())
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send({ productId: '00000000-0000-4000-8000-000000000001' })
    .expect(409);
  await prisma.serviceProduct.update({ where: { id: f.product.id }, data: { active: true } });
  const other = await request(f.app(f.other))
    .post('/api/v1/client/checkouts')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(201);
  expect(other.body.purchaseId).not.toBe(first.body.purchaseId);
  await request(f.app(f.other))
    .get(`/api/v1/client/checkouts/${first.body.purchaseId}`)
    .expect(404);
});
