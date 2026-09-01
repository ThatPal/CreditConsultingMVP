import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AppError } from '../http/errors.js';
import type {
  AuthorizationService,
  Capability,
  ResourceScope,
} from '../authorization/authorizationService.js';
import type { AuthService } from './authService.js';
import type { AuthPrincipal } from './types.js';

export type AuthorizationDenial = {
  principal: AuthPrincipal;
  capability: Capability;
  resource: ResourceScope;
  category: 'ACCESS_DENIED' | 'AUTHORIZATION_LOOKUP_FAILED' | 'RESOURCE_SCOPE_INVALID';
};
export type AuthorizationDenialRecorder = (denial: AuthorizationDenial) => Promise<void>;

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

export function requireClientAccess(
  authorization: AuthorizationService,
  parameter = 'clientId',
  recorder?: AuthorizationDenialRecorder,
): RequestHandler {
  return requireCapability(authorization, 'client.read', parameter, undefined, recorder);
}

export function requireCanonicalCapability(
  authorization: AuthorizationService,
  capability: Capability,
  options?: { requireStepUp?: boolean },
  recorder?: AuthorizationDenialRecorder,
): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) return next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'));
    const resource: ResourceScope = { type: 'platform' };
    let category: AuthorizationDenial['category'] = 'ACCESS_DENIED';
    let allowed = false;
    try {
      allowed = await authorization.authorizeCapability(req.auth, capability, options);
    } catch {
      category = 'AUTHORIZATION_LOOKUP_FAILED';
    }
    if (allowed) return next();
    if (recorder)
      await recorder({ principal: req.auth, capability, resource, category }).catch(
        () => undefined,
      );
    return next(
      new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'),
    );
  };
}

export function requireCapability(
  authorization: AuthorizationService,
  capability: Capability,
  parameter = 'clientId',
  options?: { requireStepUp?: boolean },
  recorder?: AuthorizationDenialRecorder,
): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) return next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'));
    const value = req.params[parameter];
    const clientId = typeof value === 'string' && value.length > 0 ? value : undefined;
    const resource: ResourceScope = { type: 'client', clientId: clientId ?? 'invalid' };
    let category: AuthorizationDenial['category'] = clientId
      ? 'ACCESS_DENIED'
      : 'RESOURCE_SCOPE_INVALID';
    let allowed = false;
    if (clientId) {
      try {
        allowed = await authorization.authorize(req.auth, capability, resource, options);
      } catch {
        category = 'AUTHORIZATION_LOOKUP_FAILED';
      }
    }
    if (allowed) return next();
    if (recorder)
      await recorder({ principal: req.auth, capability, resource, category }).catch(
        () => undefined,
      );
    return next(new AppError('FORBIDDEN', 403, 'You do not have permission to access this client'));
  };
}
