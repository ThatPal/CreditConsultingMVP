import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  LocalDiskDocumentStorage,
  DocumentStorageProviderUnavailableError,
  DocumentStorageRegistry,
  resolvePrivateStoragePath,
  S3CompatibleDocumentStorage,
  type DocumentStorage,
  type S3CompatibleClient,
} from './documentStorage.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

describe('private document storage', () => {
  async function expectProviderContract(storage: DocumentStorage, key: string) {
    const stored = await storage.put(key, Buffer.from('pdf'));
    expect(stored).toMatchObject({ provider: storage.provider, sizeBytes: 3 });
    expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(storage.read(key)).resolves.toEqual(Buffer.from('pdf'));
    const stream = await storage.openRead(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(Buffer.from('pdf'));
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);
    await expect(storage.read(key)).resolves.toBeNull();
  }

  test('local provider satisfies the shared private-storage contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'credit-storage-'));
    roots.push(root);
    await expectProviderContract(
      new LocalDiskDocumentStorage(root),
      'documents/client-a/document-a',
    );
  });

  test('S3-compatible adapter satisfies the same contract without public URLs', async () => {
    const objects = new Map<string, Buffer>();
    const client: S3CompatibleClient = {
      putObject: async ({ bucket, key, body }) => void objects.set(`${bucket}/${key}`, body),
      getObject: async ({ bucket, key }) => objects.get(`${bucket}/${key}`) ?? null,
      headObject: async ({ bucket, key }) => {
        const value = objects.get(`${bucket}/${key}`);
        return value ? { sizeBytes: value.length } : null;
      },
      deleteObject: async ({ bucket, key }) => void objects.delete(`${bucket}/${key}`),
    };
    const storage = new S3CompatibleDocumentStorage(
      {
        endpoint: 'http://s3.test',
        region: 'test-1',
        bucket: 'private-credit-documents',
        accessKeyIdSecretRef: 'secret://s3/access-key',
        secretAccessKeySecretRef: 'secret://s3/secret-key',
      },
      client,
    );
    await expectProviderContract(storage, 'documents/client-a/document-a');
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

  test('registry selects the default only for new writes and never falls back for records', () => {
    const local = { provider: 'LOCAL_DISK' } as DocumentStorage;
    const s3 = { provider: 'S3_COMPATIBLE' } as DocumentStorage;
    const registry = new DocumentStorageRegistry('S3_COMPATIBLE', [local, s3]);
    expect(registry.forNewUpload()).toBe(s3);
    expect(registry.forProvider('LOCAL_DISK')).toBe(local);
    expect(registry.forProvider('S3_COMPATIBLE')).toBe(s3);

    const unavailable = new DocumentStorageRegistry('LOCAL_DISK', [local]);
    expect(() => unavailable.forProvider('S3_COMPATIBLE')).toThrow(
      DocumentStorageProviderUnavailableError,
    );
  });
});
