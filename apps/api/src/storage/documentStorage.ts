import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, posix, relative, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

export type StoredDocument = {
  provider: 'LOCAL_DISK' | 'S3_COMPATIBLE';
  storageKey: string;
  sizeBytes: number;
  sha256: string;
};

export interface DocumentStorage {
  put(storageKey: string, content: Buffer): Promise<StoredDocument>;
  read(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<void>;
}

export interface S3CompatibleStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyIdSecretRef: string;
  secretAccessKeySecretRef: string;
  forcePathStyle?: boolean;
}

export function resolvePrivateStoragePath(root: string, storageKey: string) {
  if (
    !storageKey ||
    isAbsolute(storageKey) ||
    posix.isAbsolute(storageKey) ||
    win32.isAbsolute(storageKey)
  )
    throw new Error('INVALID_STORAGE_KEY');
  const path = resolve(root, storageKey);
  const relativePath = relative(root, path);
  if (relativePath.startsWith('..') || isAbsolute(relativePath))
    throw new Error('INVALID_STORAGE_KEY');
  return path;
}

export class LocalDiskDocumentStorage implements DocumentStorage {
  constructor(
    private readonly root: string,
    private readonly legacyReadRoots: string[] = [],
  ) {}

  async put(storageKey: string, content: Buffer) {
    const path = resolvePrivateStoragePath(this.root, storageKey);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
    return {
      provider: 'LOCAL_DISK' as const,
      storageKey,
      sizeBytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
  }

  async read(storageKey: string) {
    for (const root of [this.root, ...this.legacyReadRoots]) {
      const path = resolvePrivateStoragePath(root, storageKey);
      const content = await readFile(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (content) return content;
    }
    return null;
  }

  async delete(storageKey: string) {
    const path = resolvePrivateStoragePath(this.root, storageKey);
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

const defaultRoot = fileURLToPath(new URL('../../.data/', import.meta.url));
const legacyRoot = fileURLToPath(new URL('../../../../.data/', import.meta.url));
export function createLocalDocumentStorage() {
  const configured = process.env.CREDIT_REPORT_STORAGE_DIR;
  return new LocalDiskDocumentStorage(
    resolve(configured ?? defaultRoot),
    configured ? [] : [legacyRoot],
  );
}
