import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly expose = true,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError('NOT_FOUND', 404, `Route ${req.method} ${req.path} was not found`));

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    void next;
    const validation = error instanceof ZodError;
    const known = error instanceof AppError;
    const status = validation ? 400 : known ? error.status : 500;
    const code = validation ? 'VALIDATION_ERROR' : known ? error.code : 'INTERNAL_ERROR';
    const message = validation
      ? (error.issues[0]?.message ?? 'The request was invalid')
      : known && error.expose
        ? error.message
        : 'An unexpected error occurred';
    logger.error({ err: error, requestId: req.id }, 'Request failed');
    res.status(status).json({ error: { code, message, requestId: req.id } });
  };
}
