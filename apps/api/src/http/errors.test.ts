import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, test } from 'vitest';
import { errorHandler } from './errors.js';

describe('HTTP error classification', () => {
  test('classifies an invalid command body as a client validation error, not a 500', async () => {
    const app = express();
    app.use(express.json());
    app.post('/claim', (req, res) => {
      z.object({ expectedVersion: z.number().int().min(0) }).parse(req.body);
      res.sendStatus(204);
    });
    app.use(errorHandler(pino({ enabled: false })));

    const response = await request(app).post('/claim').send({ expectedVersion: 'stale' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
