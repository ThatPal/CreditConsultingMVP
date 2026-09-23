// Test/reference-only transports: no network, no provider SDK, no verified events.
import express from 'express';
import { createAuthorizationService } from '../authorization/authorizationService.js';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import type { AuthPrincipal } from '../auth/types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPaymentRouter } from './paymentRoutes.js';
import { ensureGatewayConfigs, setGatewayEnabled } from './paymentOperations.js';
import {
  PaymentGatewayRegistry,
  type PaymentGateway,
  type ProviderCheckoutRequest,
  type GatewayCapabilities,
} from './paymentGateway.js';

export class IntegrityGateway implements PaymentGateway {
  // Deliberately not TEST: exercise persisted-default resolution rather than fixture reset.
  environment = 'SANDBOX';
  healthy = true;
  fail = false;
  calls: ProviderCheckoutRequest[] = [];
  capabilities: GatewayCapabilities = {
    checkout: 'REDIRECT',
    webhooks: false,
    statusRetrieval: false,
    refund: 'UNSUPPORTED',
    reconciliation: 'UNSUPPORTED',
  };
  constructor(readonly provider: 'PAYPAL' | 'STRIPE') {}
  async health() {
    return {
      provider: this.provider,
      environment: this.environment,
      configured: true,
      healthy: this.healthy,
      connectionVerified: this.healthy,
      message: 'Entirely fake local transport',
      capabilities: this.capabilities,
    };
  }
  async createCheckout(input: ProviderCheckoutRequest) {
    this.calls.push(input);
    if (this.fail) throw new Error('SIMULATED_ORDER_FAILURE');
    return {
      providerOrderId: `FAKE-${this.provider}-${input.paymentId}`,
      checkoutUrl: `https://checkout.invalid/${input.paymentId}`,
    };
  }
  async retrieve(): Promise<never> {
    throw new Error('UNSUPPORTED_FAKE_TRANSPORT');
  }
  async verifyWebhook(): Promise<never> {
    throw new Error('UNSUPPORTED_FAKE_TRANSPORT');
  }
  async refund(): Promise<never> {
    throw new Error('UNSUPPORTED_FAKE_TRANSPORT');
  }
}
export async function integrityFixture(prisma: PrismaClient) {
  const databases = await prisma.$queryRaw<
    Array<{ name: string }>
  >`SELECT current_database() AS name`;
  if (databases[0]?.name !== 'credit_strategy_rec02_com01a')
    throw new Error('This destructive fixture requires the named disposable REC-02 database');
  const marker = `rec02-${randomUUID()}`;
  const makeUser = async (name: string, role: 'CLIENT' | 'ADMIN') => {
    const user = await prisma.user.create({
      data: {
        email: `${marker}-${name}@example.test`,
        role,
        ...(role === 'CLIENT'
          ? {
              client: {
                create: { firstName: name, lastName: 'Reference', termsAcceptedAt: new Date() },
              },
            }
          : {}),
      },
      include: { client: true },
    });
    return {
      userId: user.id,
      email: user.email,
      role,
      status: 'ACTIVE',
      clientId: user.client?.id ?? null,
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    } satisfies AuthPrincipal;
  };
  const client = await makeUser('Alpha', 'CLIENT');
  const other = await makeUser('Beta', 'CLIENT');
  const admin = await makeUser('Operator', 'ADMIN');
  const product = await prisma.serviceProduct.create({
    data: {
      key: marker,
      active: true,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          status: 'ACTIVE',
          name: 'Synthetic review',
          description: 'Disposable commerce evidence',
          price: '41.00',
          currency: 'USD',
          entitlementType: 'CREDIT_PROFILE_REVIEW',
          includedQuantity: 1,
          includedReviewCredits: 1,
        },
      },
    },
    include: { versions: true },
  });
  const a = new IntegrityGateway('PAYPAL');
  const b = new IntegrityGateway('STRIPE');
  const registry = new PaymentGatewayRegistry([a, b], 'PAYPAL');
  await prisma.paymentGatewayConfig.deleteMany();
  await ensureGatewayConfigs(prisma, registry);
  await setGatewayEnabled(prisma, 'STRIPE', true, admin.userId);
  const app = (principal: AuthPrincipal = client, permitted = true) => {
    const server = express();
    server.use(express.json());
    server.use((req, _res, next) => {
      req.auth = principal;
      next();
    });
    server.use(
      '/api/v1',
      createPaymentRouter(
        prisma,
        createAuthorizationService({
          hasRoleCapability: async (role) => permitted && role === 'ADMIN',
          hasActiveAssignment: async () => false,
          hasActiveGrant: async () => false,
        }),
        registry,
        'http://127.0.0.1:5197',
      ),
    );
    server.use(errorHandler(pino({ enabled: false })));
    return server;
  };
  return { client, other, admin, product, a, b, registry, app };
}
