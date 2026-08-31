import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { isAbsolute, posix, relative, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

export type StoredDocument = {
  provider: 'LOCAL_DISK' | 'S3_COMPATIBLE';
  storageKey: string;
  sizeBytes: number;
  sha256: string;
};

export interface DocumentStorage {
  readonly provider: StoredDocument['provider'];
  put(storageKey: string, content: Buffer): Promise<StoredDocument>;
  read(storageKey: string): Promise<Buffer | null>;
  openRead(storageKey: string): Promise<Readable | null>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
}

export class DocumentStorageProviderUnavailableError extends Error {
  readonly code = 'DOCUMENT_STORAGE_PROVIDER_UNAVAILABLE';

  constructor(readonly provider: StoredDocument['provider']) {
    super(`Document storage provider is unavailable: ${provider}`);
    this.name = 'DocumentStorageProviderUnavailableError';
  }
}

export class DocumentStorageRegistry {
  private readonly providers = new Map<StoredDocument['provider'], DocumentStorage>();

  constructor(
    readonly defaultProvider: StoredDocument['provider'],
    storages: Iterable<DocumentStorage>,
  ) {
    for (const storage of storages) {
      if (this.providers.has(storage.provider))
        throw new Error(`DUPLICATE_DOCUMENT_STORAGE_PROVIDER:${storage.provider}`);
      this.providers.set(storage.provider, storage);
    }
    this.forProvider(defaultProvider);
  }

  forNewUpload() {
    return this.forProvider(this.defaultProvider);
  }

  forProvider(provider: StoredDocument['provider']) {
    const storage = this.providers.get(provider);
    if (!storage) throw new DocumentStorageProviderUnavailableError(provider);
    return storage;
  }
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
  readonly provider = 'LOCAL_DISK' as const;
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

  async openRead(storageKey: string) {
    for (const root of [this.root, ...this.legacyReadRoots]) {
      const path = resolvePrivateStoragePath(root, storageKey);
      const found = await stat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (found?.isFile()) return createReadStream(path);
    }
    return null;
  }

  async exists(storageKey: string) {
    const stream = await this.openRead(storageKey);
    if (!stream) return false;
    stream.destroy();
    return true;
  }

  async delete(storageKey: string) {
    const path = resolvePrivateStoragePath(this.root, storageKey);
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export interface S3CompatibleClient {
  putObject(input: { bucket: string; key: string; body: Buffer }): Promise<void>;
  getObject(input: { bucket: string; key: string }): Promise<Buffer | Readable | null>;
  headObject(input: { bucket: string; key: string }): Promise<{ sizeBytes: number } | null>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

export class S3CompatibleDocumentStorage implements DocumentStorage {
  readonly provider = 'S3_COMPATIBLE' as const;
  constructor(
    private readonly config: S3CompatibleStorageConfig,
    private readonly client: S3CompatibleClient,
  ) {}

  async put(storageKey: string, content: Buffer): Promise<StoredDocument> {
    validateOpaqueStorageKey(storageKey);
    await this.client.putObject({ bucket: this.config.bucket, key: storageKey, body: content });
    return {
      provider: this.provider,
      storageKey,
      sizeBytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
  }

  async read(storageKey: string) {
    const value = await this.openRead(storageKey);
    if (!value) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of value) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async openRead(storageKey: string) {
    validateOpaqueStorageKey(storageKey);
    const value = await this.client.getObject({ bucket: this.config.bucket, key: storageKey });
    if (!value) return null;
    return Buffer.isBuffer(value) ? Readable.from(value) : value;
  }

  async exists(storageKey: string) {
    validateOpaqueStorageKey(storageKey);
    return Boolean(await this.client.headObject({ bucket: this.config.bucket, key: storageKey }));
  }

  async delete(storageKey: string) {
    validateOpaqueStorageKey(storageKey);
    await this.client.deleteObject({ bucket: this.config.bucket, key: storageKey });
  }
}

export function validateOpaqueStorageKey(storageKey: string) {
  resolvePrivateStoragePath('/', storageKey);
  return storageKey;
}

const defaultRoot = fileURLToPath(new URL('../../.data/', import.meta.url));
const legacyRoot = fileURLToPath(new URL('../../../../.data/', import.meta.url));
export function createLocalDocumentStorage() {
  const configured = process.env.DOCUMENT_STORAGE_DIR ?? process.env.CREDIT_REPORT_STORAGE_DIR;
  return new LocalDiskDocumentStorage(
    resolve(configured ?? defaultRoot),
    configured ? [] : [legacyRoot],
  );
}

export function createDocumentStorage(options?: {
  provider?: 'LOCAL_DISK' | 'S3_COMPATIBLE';
  s3Config?: S3CompatibleStorageConfig;
  s3Client?: S3CompatibleClient;
}) {
  const provider = options?.provider ?? process.env.DOCUMENT_STORAGE_PROVIDER ?? 'LOCAL_DISK';
  if (provider === 'LOCAL_DISK') return createLocalDocumentStorage();
  if (provider !== 'S3_COMPATIBLE' || !options?.s3Config || !options.s3Client)
    throw new Error('S3_STORAGE_CONFIGURATION_REQUIRED');
  return new S3CompatibleDocumentStorage(options.s3Config, options.s3Client);
}

export function createDocumentStorageRegistry(options?: {
  defaultProvider?: StoredDocument['provider'];
  storages?: Iterable<DocumentStorage>;
  s3Config?: S3CompatibleStorageConfig;
  s3Client?: S3CompatibleClient;
}) {
  const defaultProvider =
    options?.defaultProvider ??
    (process.env.DOCUMENT_STORAGE_PROVIDER as StoredDocument['provider'] | undefined) ??
    'LOCAL_DISK';
  const storages = options?.storages
    ? [...options.storages]
    : [createDocumentStorage({ provider: defaultProvider, ...options })];
  return new DocumentStorageRegistry(defaultProvider, storages);
}
