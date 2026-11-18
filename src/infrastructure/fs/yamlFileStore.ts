import { randomUUID } from 'node:crypto';
import { ConflictError, DuplicateEntityError, EntityNotFoundError, StorageError } from '../../domain/errors';
import type { UriLike, WorkspaceFileSystem } from '../../application/ports';
import { revisionOf } from '../yaml/codecs';
import { WriteRegistry } from './caches';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const utf8Encoder = new TextEncoder();

export type WriteMode = 'create' | 'update' | 'replace';

export interface WriteOptions {
  mode: WriteMode;
  entity: string;
  expectedRevision?: string;
}

export class YamlFileStore {
  constructor(
    private readonly fs: WorkspaceFileSystem,
    private readonly writeRegistry: WriteRegistry = new WriteRegistry(),
  ) {}

  async read(uri: UriLike): Promise<{ raw: string; revision: string } | undefined> {
    if (!(await this.fs.exists(uri))) {
      return undefined;
    }
    let bytes: Uint8Array;
    try {
      bytes = await this.fs.readFile(uri);
    } catch (error) {
      throw new StorageError('Could not read a board file.', messageOf(error));
    }
    let raw: string;
    try {
      raw = utf8Decoder.decode(bytes);
    } catch (error) {
      throw new StorageError('A board file is not valid UTF-8.', messageOf(error));
    }
    return { raw, revision: revisionOf(raw) };
  }

  async write(uri: UriLike, content: string, options: WriteOptions): Promise<{ revision: string }> {
    const existing = await this.read(uri);

    if (options.mode === 'create' && existing) {
      throw new DuplicateEntityError(options.entity, this.fs.basename(uri));
    }
    if (options.mode === 'update') {
      if (!existing) {
        throw new EntityNotFoundError(options.entity, this.fs.basename(uri));
      }
      if (options.expectedRevision && existing.revision !== options.expectedRevision) {
        throw new ConflictError(options.entity);
      }
    }

    await this.ensureParent(uri);
    const bytes = utf8Encoder.encode(content);
    const temp = this.fs.joinPath(
      this.fs.dirname(uri),
      `.${this.fs.basename(uri)}.${randomUUID()}.tmp`,
    );

    try {
      await this.fs.writeFile(temp, bytes);
      try {
        await this.fs.rename(temp, uri, { overwrite: true });
      } catch {
        await this.fs.delete(temp).catch(() => undefined);
        await this.fs.writeFile(uri, bytes);
      }
    } catch (error) {
      await this.fs.delete(temp).catch(() => undefined);
      throw new StorageError('Could not write a board file.', messageOf(error));
    }

    const revision = revisionOf(content);
    this.writeRegistry.mark(uri.toString(), revision);
    return { revision };
  }

  async delete(uri: UriLike, recursive = false): Promise<void> {
    try {
      if (await this.fs.exists(uri)) {
        await this.fs.delete(uri, { recursive });
      }
    } catch (error) {
      throw new StorageError('Could not delete a board file.', messageOf(error));
    }
  }

  async list(uri: UriLike): Promise<import('../../application/ports').DirectoryEntry[]> {
    try {
      return await this.fs.readDirectory(uri);
    } catch (error) {
      throw new StorageError('Could not read the board directory.', messageOf(error));
    }
  }

  isSelfWrite(uri: UriLike, digest: string): boolean {
    return this.writeRegistry.shouldIgnore(uri.toString(), digest);
  }

  private async ensureParent(uri: UriLike): Promise<void> {
    const parent = this.fs.dirname(uri);
    if (!(await this.fs.exists(parent))) {
      await this.fs.createDirectory(parent);
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
