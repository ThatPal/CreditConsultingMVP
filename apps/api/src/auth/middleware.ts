import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AppError } from '../http/errors.js';
import type { AuthService } from './authService.js';

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
  return async (req, _res, next) => {
    try {
      if (!req.auth) return next(new AppError('AUTH_REQUIRED', 401, 'Authentication is required'));
      const value = req.params[parameter];
      const clientId = typeof value === 'string' ? value : undefined;
      if (!clientId || !(await auth.canAccessClient(req.auth, clientId))) {
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
