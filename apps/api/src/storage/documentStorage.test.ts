import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { LocalDiskDocumentStorage, resolvePrivateStoragePath } from './documentStorage.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

describe('private document storage', () => {
  test('round-trips private bytes and stable metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'credit-storage-'));
    roots.push(root);
    const storage = new LocalDiskDocumentStorage(root);
    const stored = await storage.put('credit-reports/client-a/report.pdf', Buffer.from('pdf'));
    expect(stored).toMatchObject({ provider: 'LOCAL_DISK', sizeBytes: 3 });
    await expect(storage.read(stored.storageKey)).resolves.toEqual(Buffer.from('pdf'));
    await storage.delete(stored.storageKey);
    await expect(storage.read(stored.storageKey)).resolves.toBeNull();
  });

  test('rejects traversal and absolute storage keys', () => {
    expect(() => resolvePrivateStoragePath('C:\\safe', '../secret')).toThrow('INVALID_STORAGE_KEY');
    expect(() => resolvePrivateStoragePath('C:\\safe', 'C:\\secret')).toThrow(
      'INVALID_STORAGE_KEY',
    );
    expect(() => resolvePrivateStoragePath('/safe', 'C:/secret')).toThrow('INVALID_STORAGE_KEY');
    expect(() => resolvePrivateStoragePath('/safe', '\\\\server\\share\\secret')).toThrow(
      'INVALID_STORAGE_KEY',
    );
    expect(() => resolvePrivateStoragePath('C:\\safe', '/secret')).toThrow('INVALID_STORAGE_KEY');
  });
});
