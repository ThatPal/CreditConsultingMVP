import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AppError } from '../http/errors.js';
import {
  createAuthorizationService,
  type Capability,
} from '../authorization/authorizationService.js';
import type { AuthService } from './authService.js';
import type { AuthPrincipal } from './types.js';

export function authenticate(auth: AuthService, cookieName: string): RequestHandler {
  return async (req, _res, next) => {
    try {
      const principal = await auth.authenticate(req.cookies?.[cookieName] as string | undefined);
      if (principal) req.auth = principal;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authenticatePrincipal(
  resolve: (headers: import('node:http').IncomingHttpHeaders) => Promise<AuthPrincipal | null>,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const principal = await resolve(req.headers);
      if (principal) req.auth = principal;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth: RequestHandler = (req, _res, next) =>
  req.auth ? next() : next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'));

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) =>
    !req.auth
      ? next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'))
      : roles.includes(req.auth.role)
        ? next()
        : next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
}

export function requireClientAccess(auth: AuthService, parameter = 'clientId'): RequestHandler {
  return requireCapability(auth, 'client.read', parameter);
}

export function requireCapability(
  auth: AuthService,
  capability: Capability,
  parameter = 'clientId',
  options?: { requireStepUp?: boolean },
): RequestHandler {
  const authorization = createAuthorizationService({
    hasRoleCapability: async (role, requested) => {
      const policy: Record<string, readonly Capability[]> = {
        CLIENT: ['client.read', 'review.read', 'support.read'],
        CONSULTANT: [
          'client.read',
          'client.manage',
          'review.read',
          'review.publish',
          'support.read',
          'support.manage',
        ],
        ADMIN: ['settings.manage', 'audit.read_platform', 'support.manage'],
      };
      return policy[role]?.includes(requested) ?? false;
    },
    hasActiveAssignment: async (userId, clientId) =>
      auth.canAccessClient(
        { userId, email: '', role: 'CONSULTANT', status: 'ACTIVE', clientId: null },
        clientId,
      ),
    hasActiveGrant: async () => false,
  });
  return async (req, _res, next) => {
    try {
      if (!req.auth) return next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'));
      const value = req.params[parameter];
      const clientId = typeof value === 'string' ? value : undefined;
      if (
        !clientId ||
        !(await authorization.authorize(
          req.auth,
          capability,
          { type: 'client', clientId },
          options,
        ))
      ) {
        return next(
          new AppError('FORBIDDEN', 403, 'You do not have permission to access this client'),
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
