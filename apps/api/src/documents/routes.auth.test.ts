import express from 'express';
import request from 'supertest';
import pino from 'pino';
import { expect, test, vi } from 'vitest';
import { createDocumentRouter } from './routes.js';
import { errorHandler } from '../http/errors.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { DocumentStorageRegistry } from '../storage/documentStorage.js';

test.each([
  { identity: 'anonymous', status: 401, code: 'AUTH_REQUIRED' },
  { identity: 'staff', status: 403, code: 'FORBIDDEN' },
  { identity: 'unlinked-client', status: 403, code: 'FORBIDDEN' },
])(
  'upload distinguishes $identity from an authorized client',
  async ({ identity, status, code }) => {
    const authorize = vi.fn();
    const store = vi.fn();
    const app = express();
    app.use((req, _res, next) => {
      if (identity !== 'anonymous')
        req.auth = {
          userId: 'synthetic',
          email: 'synthetic@example.test',
          role: identity === 'staff' ? 'CONSULTANT' : 'CLIENT',
          status: 'ACTIVE',
          clientId: null,
        };
      next();
    });
    app.use(
      '/documents',
      createDocumentRouter(
        {} as PrismaClient,
        { authorize } as unknown as AuthorizationService,
        { forNewUpload: store } as unknown as DocumentStorageRegistry,
      ),
    );
    app.use(errorHandler(pino({ enabled: false })));
    const response = await request(app)
      .post('/documents')
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'synthetic.pdf')
      .set('X-Document-Type', 'GENERAL_CLIENT_DOCUMENT')
      .send(Buffer.from('%PDF-synthetic'))
      .expect(status);
    expect(response.body.error.code).toBe(code);
    expect(authorize).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  },
);
