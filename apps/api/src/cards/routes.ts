import { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import { requireCapability, requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  approveCandidate,
  approveInsight,
  identifyClientCard,
  ingestCandidate,
  listCandidates,
  listCatalog,
  listClientCards,
  listInsights,
  listWishlist,
  offerHistory,
  prepareInsight,
  rejectInsight,
  reviewCandidate,
  saveClientCard,
  setWishlist,
} from './service.js';

const querySchema = z.object({
  search: z.string().max(100).optional(),
  audience: z.enum(['PERSONAL', 'BUSINESS']).optional(),
  portfolioType: z
    .enum(['PERSONAL_CREDIT', 'BUSINESS_CREDIT', 'SECURED', 'NON_REPORTING'])
    .optional(),
});
const cardSchema = z.object({
  cardName: z.string().min(1).max(160),
  issuer: z.string().min(1).max(160),
  scope: z.enum(['PERSONAL', 'BUSINESS']),
  portfolioType: z.enum(['PERSONAL_CREDIT', 'BUSINESS_CREDIT', 'SECURED', 'NON_REPORTING']),
  reportsToBureaus: z.boolean().nullable().optional(),
  maskedIdentifier: z.string().max(20).nullable().optional(),
  creditLimit: z.number().nonnegative().nullable().optional(),
  balance: z.number().nonnegative().nullable().optional(),
  accountStatus: z.enum(['OPEN', 'CLOSED']).optional(),
});

export function createCardRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  recorder?: AuthorizationDenialRecorder,
) {
  const router = Router();
  router.get(
    '/cards/catalog',
    requireCapability(authorization, 'catalog.read', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        res.json({ products: await listCatalog(prisma, querySchema.parse(req.query)) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/cards/catalog/:productId/offers',
    requireCapability(authorization, 'catalog.read', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        res.json({ offers: await offerHistory(prisma, req.params.productId as string) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/client/cards', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json({ cards: await listClientCards(prisma, req.auth!.clientId!, true) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/cards', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          await saveClientCard(prisma, {
            clientId: req.auth!.clientId!,
            actorId: req.auth!.userId,
            ...cardSchema.parse(req.body),
          }),
        );
    } catch (error) {
      next(error);
    }
  });
  router.put('/client/cards/:cardId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(
        await saveClientCard(prisma, {
          clientId: req.auth!.clientId!,
          actorId: req.auth!.userId,
          cardId: req.params.cardId as string,
          ...cardSchema.parse(req.body),
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/cards/:cardId/identify', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const body = z
        .object({
          productId: z.string().uuid().nullable(),
          evidence: z.record(z.string(), z.unknown()),
        })
        .parse(req.body);
      res.json(
        await identifyClientCard(prisma, {
          clientId: req.auth!.clientId!,
          cardId: req.params.cardId as string,
          actorId: req.auth!.userId,
          ...body,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/cards/wishlist', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json({ wishlist: await listWishlist(prisma, req.auth!.clientId!) });
    } catch (error) {
      next(error);
    }
  });
  router.put('/client/cards/wishlist/:productId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const body = z.object({ note: z.string().max(500).nullable().optional() }).parse(req.body);
      res.json(
        await setWishlist(prisma, {
          clientId: req.auth!.clientId!,
          productId: req.params.productId as string,
          actorId: req.auth!.userId,
          ...body,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.delete(
    '/client/cards/wishlist/:productId',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        res.json(
          await setWishlist(prisma, {
            clientId: req.auth!.clientId!,
            productId: req.params.productId as string,
            actorId: req.auth!.userId,
            remove: true,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/clients/:clientId/cards',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'client.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        res.json({ cards: await listClientCards(prisma, req.params.clientId as string) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cards/:cardId/identify',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'client.manage', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            productId: z.string().uuid().nullable(),
            evidence: z.record(z.string(), z.unknown()),
          })
          .parse(req.body);
        res.json(
          await identifyClientCard(prisma, {
            clientId: req.params.clientId as string,
            cardId: req.params.cardId as string,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/catalog/candidates',
    requireCapability(authorization, 'catalog.read', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        const status = z
          .enum(['PENDING', 'CONFLICT', 'APPROVED', 'REJECTED', 'MERGED'])
          .optional()
          .parse(req.query.status);
        res.json({ candidates: await listCandidates(prisma, status) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/candidates',
    requireCapability(authorization, 'catalog.manage', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            sourceKey: z.string(),
            sourceIdentity: z.string(),
            sourceUrl: z.string().url(),
            kind: z.enum(['NEW_PRODUCT', 'OFFER_CHANGE']),
            matchedProductId: z.string().uuid().optional(),
            payload: z.record(z.string(), z.unknown()),
            evidence: z.record(z.string(), z.unknown()),
            conflicts: z.array(z.unknown()).optional(),
            materialConflict: z.boolean().optional(),
          })
          .parse(req.body);
        res.status(201).json(await ingestCandidate(prisma, body));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/candidates/:candidateId/approve',
    requireCapability(
      authorization,
      'catalog.manage',
      undefined,
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            expectedVersion: z.number().int().positive(),
            reason: z.string().min(1).max(1000),
          })
          .parse(req.body);
        res.json(
          await approveCandidate(prisma, {
            candidateId: req.params.candidateId as string,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/candidates/:candidateId/review',
    requireCapability(
      authorization,
      'catalog.manage',
      undefined,
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            expectedVersion: z.number().int().positive(),
            action: z.enum(['REJECT', 'MERGE', 'RESOLVE_CONFLICT']),
            reason: z.string().min(1).max(1000),
            matchedProductId: z.string().uuid().optional(),
          })
          .parse(req.body);
        res.json(
          await reviewCandidate(prisma, {
            candidateId: req.params.candidateId as string,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/products/:productId/insights',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'catalog.manage', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            summary: z.string().min(1).max(2000),
            rationale: z.string().max(4000).optional(),
            strengths: z.array(z.string()),
            cautions: z.array(z.string()),
            confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
            evidence: z.array(z.unknown()),
            ai: z
              .object({
                processKey: z.string(),
                processVersion: z.number().int().positive(),
                modelProvenance: z.record(z.string(), z.unknown()),
                proposedPayload: z.record(z.string(), z.unknown()),
              })
              .optional(),
          })
          .parse(req.body);
        res
          .status(201)
          .json(
            await prepareInsight(prisma, {
              productId: req.params.productId as string,
              actorId: req.auth!.userId,
              ...body,
            }),
          );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/catalog/insights',
    requireCapability(authorization, 'catalog.manage', undefined, undefined, recorder),
    async (req, res, next) => {
      try {
        const status = z
          .enum(['PREPARED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'STALE', 'SUPERSEDED'])
          .optional()
          .parse(req.query.status);
        res.json({ insights: await listInsights(prisma, status) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/insights/:insightId/approve',
    requireRole('CONSULTANT'),
    requireCapability(
      authorization,
      'catalog.manage',
      undefined,
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            note: z.string().min(1).max(1000),
            idempotencyKey: z.string().min(8).max(160),
            edits: z
              .object({
                summary: z.string().max(2000).optional(),
                rationale: z.string().max(4000).optional(),
                strengths: z.array(z.string()).optional(),
                cautions: z.array(z.string()).optional(),
              })
              .optional(),
          })
          .parse(req.body);
        res.json(
          await approveInsight(prisma, {
            insightId: req.params.insightId as string,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/catalog/insights/:insightId/reject',
    requireRole('CONSULTANT'),
    requireCapability(
      authorization,
      'catalog.manage',
      undefined,
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        const body = z.object({ note: z.string().min(1).max(1000) }).parse(req.body);
        res.json(
          await rejectInsight(prisma, {
            insightId: req.params.insightId as string,
            actorId: req.auth!.userId,
            note: body.note,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
