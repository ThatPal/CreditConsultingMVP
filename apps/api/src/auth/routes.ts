import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppEnv } from '../config/env.js';
import { AppError } from '../http/errors.js';
import type { AuthService } from './authService.js';
import { requireAuth, requireRole } from './middleware.js';

const password = z.string().min(12, 'Password must contain at least 12 characters').max(128);
const email = z.string().trim().pipe(z.email());
const goalType = z.enum([
  'ZERO_APR_CREDIT',
  'TOTAL_AVAILABLE_CREDIT',
  'BUSINESS_CREDIT',
  'PERSONAL_CREDIT',
  'BALANCE_TRANSFER_CAPACITY',
  'EXISTING_LIMIT_INCREASES',
  'REWARDS_POINTS_PORTFOLIO',
]);
const monetaryGoals = new Set([
  'ZERO_APR_CREDIT',
  'TOTAL_AVAILABLE_CREDIT',
  'BUSINESS_CREDIT',
  'PERSONAL_CREDIT',
  'BALANCE_TRANSFER_CAPACITY',
  'EXISTING_LIMIT_INCREASES',
]);
const goalSchema = z.object({
  goalType,
  scope: z.enum(['PERSONAL', 'BUSINESS', 'BOTH']),
  targetAmount: z.number().positive().max(100_000_000).optional(),
  priority: z.enum(['PRIMARY', 'SECONDARY']),
});
const registerSchema = z
  .object({
    email,
    password,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().min(7).max(30).optional(),
    ),
    timezone: z.string().trim().min(1).max(80).default('America/New_York'),
    termsAccepted: z.literal(true),
    goals: z.array(goalSchema).min(1).max(7).optional(),
  })
  .superRefine((input, context) => {
    if (!input.goals) return;
    if (input.goals.filter((goal) => goal.priority === 'PRIMARY').length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['goals'],
        message: 'Select exactly one primary goal',
      });
    for (const [index, goal] of input.goals.entries()) {
      if (monetaryGoals.has(goal.goalType) && goal.targetAmount === undefined)
        context.addIssue({
          code: 'custom',
          path: ['goals', index, 'targetAmount'],
          message: 'A target amount is required for this goal',
        });
    }
    const unique = new Set(input.goals.map((goal) => `${goal.goalType}:${goal.scope}`));
    if (unique.size !== input.goals.length)
      context.addIssue({
        code: 'custom',
        path: ['goals'],
        message: 'Duplicate goals are not allowed',
      });
  });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(32).max(256), password });
const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(30).nullable().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      result.error.issues[0]?.message ?? 'Request validation failed',
    );
  return result.data;
}

function cookieOptions(env: AppEnv, expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    expires: expiresAt,
  };
}

export function createAuthRouter(auth: AuthService, env: AppEnv) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.NODE_ENV === 'test' ? 1000 : 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.',
      },
    },
  });
  const setSession = (res: Response, session: { token: string; expiresAt: Date }) =>
    res.cookie(env.SESSION_COOKIE_NAME, session.token, cookieOptions(env, session.expiresAt));

  router.post('/register', limiter, async (req, res, next) => {
    try {
      const input = parse(registerSchema, req.body);
      const { goals, ...account } = input;
      const session = await auth.register(
        { ...account, ...(goals ? { goals } : {}) },
        req.get('user-agent'),
      );
      setSession(res, session);
      res.status(201).json({ user: session.principal });
    } catch (error) {
      next(error);
    }
  });
  router.post('/login', limiter, async (req, res, next) => {
    try {
      const input = parse(loginSchema, req.body);
      const session = await auth.login(input.email, input.password, req.get('user-agent'));
      setSession(res, session);
      res.json({ user: session.principal });
    } catch (error) {
      next(error);
    }
  });
  router.post('/logout', async (req, res, next) => {
    try {
      await auth.logout(req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined);
      res.clearCookie(env.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.post('/forgot-password', limiter, async (req, res, next) => {
    try {
      await auth.forgotPassword(parse(forgotSchema, req.body).email);
      res.status(202).json({
        message: 'If an eligible account exists, password reset instructions will be sent.',
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/reset-password', limiter, async (req, res, next) => {
    try {
      const input = parse(resetSchema, req.body);
      await auth.resetPassword(input.token, input.password);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createMeRouter(auth: AuthService) {
  const router = Router();
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const user = await auth.getMe(req.auth!.userId);
      if (!user) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/', requireAuth, requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json({ user: await auth.updateMe(req.auth!.userId, parse(updateMeSchema, req.body)) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
