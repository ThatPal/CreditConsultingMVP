import { describe, expect, test } from 'vitest';
import { sanitizeDocumentFileName } from './routes.js';

describe('document filename safety', () => {
  test('removes path and response-header injection characters', () => {
    expect(sanitizeDocumentFileName('../folder\\report\r\nInjected.pdf')).toBe(
      'folder-reportInjected.pdf',
    );
    expect(() => sanitizeDocumentFileName('../..')).toThrow('A safe file name is required');
  });
});
