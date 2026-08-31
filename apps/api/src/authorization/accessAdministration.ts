import type { ClientAccessScope, PrismaClient } from '../generated/prisma/client.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import type { Capability } from './authorizationService.js';

type CommandContext = { actorId: string; idempotencyKey: string };

export function createAccessAdministration(prisma: PrismaClient) {
  return {
    assignStaff(input: CommandContext & { staffUserId: string; clientId: string }) {
      return executeConsequentialCommand<{ id: string }>(prisma, {
        idempotency: {
          scope: 'authorization',
          subjectId: input.clientId,
          operation: 'assign-staff',
          key: input.idempotencyKey,
        },
        audit: (result) => ({
          action: 'STAFF_CLIENT_ASSIGNED',
          entityType: 'StaffClientAssignment',
          entityId: result.id as string,
          clientId: input.clientId,
          actorId: input.actorId,
        }),
        outbox: {
          eventType: 'authorization.staff-assigned',
          eventKey: input.idempotencyKey,
          aggregateType: 'Client',
          aggregateId: input.clientId,
          payload: (result) => result,
        },
        mutate: async (tx) => {
          const assignment = await tx.staffClientAssignment.upsert({
            where: {
              staffUserId_clientId: { staffUserId: input.staffUserId, clientId: input.clientId },
            },
            create: { staffUserId: input.staffUserId, clientId: input.clientId },
            update: { activatedAt: new Date(), deactivatedAt: null },
            select: { id: true },
          });
          await tx.securityEvent.create({
            data: {
              actorId: input.actorId,
              clientId: input.clientId,
              eventType: 'AUTHZ_ASSIGNMENT_CREATED',
              category: 'AUTHORIZATION',
              entityType: 'StaffClientAssignment',
              entityId: assignment.id,
            },
          });
          return assignment;
        },
      });
    },
    grantAccess(
      input: CommandContext & {
        granteeId: string;
        clientId: string;
        scope: ClientAccessScope;
        capabilities: Capability[];
        reason: string;
        reference?: string;
        startsAt: Date;
        expiresAt: Date;
      },
    ) {
      return executeConsequentialCommand<{ id: string }>(prisma, {
        idempotency: {
          scope: 'authorization',
          subjectId: input.clientId,
          operation: 'grant-access',
          key: input.idempotencyKey,
        },
        audit: (result) => ({
          action: 'CLIENT_ACCESS_GRANTED',
          entityType: 'ClientAccessGrant',
          entityId: result.id as string,
          clientId: input.clientId,
          actorId: input.actorId,
          metadata: { scope: input.scope, expiresAt: input.expiresAt.toISOString() },
        }),
        outbox: {
          eventType: 'authorization.access-granted',
          eventKey: input.idempotencyKey,
          aggregateType: 'Client',
          aggregateId: input.clientId,
          payload: (result) => ({ id: result.id, clientId: input.clientId, scope: input.scope }),
        },
        mutate: async (tx) => {
          if (input.expiresAt <= input.startsAt) throw new Error('ACCESS_GRANT_EXPIRY_REQUIRED');
          const roleRows = await tx.roleCapability.findMany({
            where: {
              role: (
                await tx.user.findUniqueOrThrow({
                  where: { id: input.granteeId },
                  select: { role: true },
                })
              ).role,
            },
            select: { capability: true },
          });
          const allowed = new Set(roleRows.map(({ capability }) => capability));
          if (input.capabilities.some((capability) => !allowed.has(capability)))
            throw new Error('GRANT_CANNOT_CREATE_CAPABILITY');
          const grant = await tx.clientAccessGrant.create({
            data: {
              granteeId: input.granteeId,
              clientId: input.clientId,
              scope: input.scope,
              allowedCapabilities: input.capabilities,
              reason: input.reason,
              ...(input.reference ? { reference: input.reference } : {}),
              startsAt: input.startsAt,
              expiresAt: input.expiresAt,
              grantorId: input.actorId,
            },
            select: { id: true },
          });
          await tx.securityEvent.create({
            data: {
              actorId: input.actorId,
              clientId: input.clientId,
              eventType: 'AUTHZ_ACCESS_GRANTED',
              category: 'AUTHORIZATION',
              entityType: 'ClientAccessGrant',
              entityId: grant.id,
              metadata: { scope: input.scope },
            },
          });
          return grant;
        },
      });
    },
    revokeGrant(input: CommandContext & { grantId: string }) {
      return executeConsequentialCommand<{ id: string; clientId: string }>(prisma, {
        idempotency: {
          scope: 'authorization',
          subjectId: input.grantId,
          operation: 'revoke-grant',
          key: input.idempotencyKey,
        },
        audit: (result) => ({
          action: 'CLIENT_ACCESS_REVOKED',
          entityType: 'ClientAccessGrant',
          entityId: input.grantId,
          clientId: result.clientId as string,
          actorId: input.actorId,
        }),
        outbox: {
          eventType: 'authorization.access-revoked',
          eventKey: input.idempotencyKey,
          aggregateType: 'ClientAccessGrant',
          aggregateId: input.grantId,
          payload: (result) => result,
        },
        mutate: async (tx) => {
          const grant = await tx.clientAccessGrant.update({
            where: { id: input.grantId },
            data: { revokedAt: new Date(), revokerId: input.actorId },
            select: { id: true, clientId: true },
          });
          await tx.securityEvent.create({
            data: {
              actorId: input.actorId,
              clientId: grant.clientId,
              eventType: 'AUTHZ_ACCESS_REVOKED',
              severity: 'WARNING',
              category: 'AUTHORIZATION',
              entityType: 'ClientAccessGrant',
              entityId: grant.id,
            },
          });
          return grant;
        },
      });
    },
  };
}
