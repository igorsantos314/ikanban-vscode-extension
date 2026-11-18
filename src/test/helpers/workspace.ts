import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename as nodeBasename, dirname as nodeDirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  DirectoryEntry,
  FileStat,
  FileType,
  UriLike,
  WorkspaceFileSystem,
} from '../../application/ports';
import { YamlFileStore } from '../../infrastructure/fs/yamlFileStore';
import { YamlBoardRepository } from '../../infrastructure/repositories/yamlBoardRepository';
import { YamlTaskRepository } from '../../infrastructure/repositories/yamlTaskRepository';

export function uriForPath(fsPath: string): UriLike {
  const absolute = resolve(fsPath);
  const url = pathToFileURL(absolute);
  return {
    scheme: 'file',
    authority: '',
    path: decodeURIComponent(url.pathname),
    query: '',
    fragment: '',
    fsPath: absolute,
    toString: () => url.toString(),
  };
}

function entryType(type: import('node:fs').Dirent): FileType {
  if (type.isFile()) {
    return 'file';
  }
  if (type.isDirectory()) {
    return 'directory';
  }
  return 'unknown';
}

export class NodeWorkspaceFileSystem implements WorkspaceFileSystem {
  async readFile(uri: UriLike): Promise<Uint8Array> {
    return new Uint8Array(await readFile(uri.fsPath));
  }

  async writeFile(uri: UriLike, content: Uint8Array): Promise<void> {
    await writeFile(uri.fsPath, content);
  }

  async delete(uri: UriLike, options?: { recursive?: boolean }): Promise<void> {
    await rm(uri.fsPath, { recursive: options?.recursive ?? false, force: false });
  }

  async createDirectory(uri: UriLike): Promise<void> {
    await mkdir(uri.fsPath, { recursive: true });
  }

  async readDirectory(uri: UriLike): Promise<DirectoryEntry[]> {
    const entries = await readdir(uri.fsPath, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, type: entryType(entry) }));
  }

  async stat(uri: UriLike): Promise<FileStat> {
    const value = await stat(uri.fsPath);
    return {
      type: value.isFile() ? 'file' : value.isDirectory() ? 'directory' : 'unknown',
      size: value.size,
      mtime: value.mtimeMs,
    };
  }

  async exists(uri: UriLike): Promise<boolean> {
    try {
      await access(uri.fsPath);
      return true;
    } catch {
      return false;
    }
  }

  async rename(
    source: UriLike,
    target: UriLike,
    options?: { overwrite?: boolean },
  ): Promise<void> {
    if (!options?.overwrite && (await this.exists(target))) {
      throw new Error(`Target already exists: ${target.fsPath}`);
    }
    await rename(source.fsPath, target.fsPath);
  }

  joinPath(base: UriLike, ...segments: string[]): UriLike {
    return uriForPath(join(base.fsPath, ...segments));
  }

  dirname(uri: UriLike): UriLike {
    return uriForPath(nodeDirname(uri.fsPath));
  }

  basename(uri: UriLike): string {
    return nodeBasename(uri.fsPath);
  }
}

export interface TestWorkspace {
  root: string;
  rootUri: UriLike;
  ikanbanUri: UriLike;
  fs: NodeWorkspaceFileSystem;
  store: YamlFileStore;
  board: YamlBoardRepository;
  tasks: YamlTaskRepository;
  cleanup(): Promise<void>;
}

export async function createTestWorkspace(): Promise<TestWorkspace> {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-test-'));
  const fs = new NodeWorkspaceFileSystem();
  const rootUri = uriForPath(root);
  const ikanbanUri = fs.joinPath(rootUri, '.ikanban');
  const store = new YamlFileStore(fs);
  const board = new YamlBoardRepository(fs, store, ikanbanUri);
  const tasks = new YamlTaskRepository(fs, store, board);
  return {
    root,
    rootUri,
    ikanbanUri,
    fs,
    store,
    board,
    tasks,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export class FaultyFileSystem implements WorkspaceFileSystem {
  constructor(
    private readonly inner: WorkspaceFileSystem,
    private readonly faults: {
      rename?: boolean;
      writeFile?: boolean;
      deleteFile?: boolean | ((uri: UriLike) => boolean);
    } = {},
  ) {}

  readFile(uri: UriLike): Promise<Uint8Array> {
    return this.inner.readFile(uri);
  }

  writeFile(uri: UriLike, content: Uint8Array): Promise<void> {
    if (this.faults.writeFile) {
      return Promise.reject(new Error('Injected write failure'));
    }
    return this.inner.writeFile(uri, content);
  }

  delete(uri: UriLike, options?: { recursive?: boolean }): Promise<void> {
    const shouldFail =
      typeof this.faults.deleteFile === 'function'
        ? this.faults.deleteFile(uri)
        : this.faults.deleteFile;
    if (shouldFail) {
      return Promise.reject(new Error('Injected delete failure'));
    }
    return this.inner.delete(uri, options);
  }

  createDirectory(uri: UriLike): Promise<void> {
    return this.inner.createDirectory(uri);
  }

  readDirectory(uri: UriLike): Promise<DirectoryEntry[]> {
    return this.inner.readDirectory(uri);
  }

  stat(uri: UriLike): Promise<FileStat> {
    return this.inner.stat(uri);
  }

  exists(uri: UriLike): Promise<boolean> {
    return this.inner.exists(uri);
  }

  rename(source: UriLike, target: UriLike, options?: { overwrite?: boolean }): Promise<void> {
    if (this.faults.rename) {
      return Promise.reject(new Error('Injected rename failure'));
    }
    return this.inner.rename(source, target, options);
  }

  joinPath(base: UriLike, ...segments: string[]): UriLike {
    return this.inner.joinPath(base, ...segments);
  }

  dirname(uri: UriLike): UriLike {
    return this.inner.dirname(uri);
  }

  basename(uri: UriLike): string {
    return this.inner.basename(uri);
  }
}

export class FixedClock {
  constructor(private current = new Date('2026-11-18T10:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequenceIdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    const suffix = String(this.counter).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }
}
