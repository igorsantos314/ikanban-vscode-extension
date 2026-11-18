import { afterEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  ConflictError,
  DuplicateEntityError,
  EntityNotFoundError,
  StorageError,
} from '../../domain/errors';
import { ParseCache, WriteRegistry } from './caches';
import { FaultyFileSystem, NodeWorkspaceFileSystem, uriForPath } from '../../test/helpers/workspace';
import { YamlFileStore } from './yamlFileStore';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function tempStore(faults: { rename?: boolean; writeFile?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-store-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const base = new NodeWorkspaceFileSystem();
  const fs = new FaultyFileSystem(base, faults);
  return {
    root,
    fs: base,
    store: new YamlFileStore(fs),
    uri: uriForPath(join(root, 'board.yaml')),
  };
}

describe('YamlFileStore', () => {
  it('writes and reads UTF-8 content with a revision', async () => {
    const { store, uri } = await tempStore();
    const written = await store.write(uri, 'name: Ação 🚀\n', {
      mode: 'create',
      entity: 'Board',
    });
    const read = await store.read(uri);
    expect(read?.raw).toBe('name: Ação 🚀\n');
    expect(read?.revision).toBe(written.revision);
  });

  it('rejects duplicate creation', async () => {
    const { store, uri } = await tempStore();
    await store.write(uri, 'a: 1\n', { mode: 'create', entity: 'Board' });
    await expect(store.write(uri, 'a: 2\n', { mode: 'create', entity: 'Board' })).rejects.toBeInstanceOf(
      DuplicateEntityError,
    );
  });

  it('rejects updates to missing files', async () => {
    const { store, uri } = await tempStore();
    await expect(
      store.write(uri, 'a: 1\n', { mode: 'update', entity: 'Task', expectedRevision: 'x' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('rejects stale revisions without overwriting external content', async () => {
    const { store, uri } = await tempStore();
    const written = await store.write(uri, 'title: old\n', {
      mode: 'create',
      entity: 'Task',
    });
    await store.write(uri, 'title: external\n', {
      mode: 'update',
      entity: 'Task',
      expectedRevision: written.revision,
    });
    await expect(
      store.write(uri, 'title: ours\n', {
        mode: 'update',
        entity: 'Task',
        expectedRevision: written.revision,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await store.read(uri))?.raw).toBe('title: external\n');
  });

  it('falls back to a direct write when rename fails', async () => {
    const { store, fs, uri, root } = await tempStore({ rename: true });
    await store.write(uri, 'title: fallback\n', { mode: 'create', entity: 'Task' });
    expect((await store.read(uri))?.raw).toBe('title: fallback\n');
    const entries = await fs.readDirectory(uriForPath(root));
    expect(entries.some((entry) => entry.name.includes('.tmp.'))).toBe(false);
  });

  it('cleans up and reports storage failures', async () => {
    const { store, fs, uri, root } = await tempStore({ writeFile: true });
    await expect(
      store.write(uri, 'title: fail\n', { mode: 'create', entity: 'Task' }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(await fs.readDirectory(uriForPath(root))).toEqual([]);
  });

  it('reports invalid UTF-8', async () => {
    const { store, fs, uri } = await tempStore();
    await fs.writeFile(uri, new Uint8Array([0xff, 0xfe]));
    await expect(store.read(uri)).rejects.toBeInstanceOf(StorageError);
  });

  it('marks and detects self writes', async () => {
    const { store, uri } = await tempStore();
    const written = await store.write(uri, 'a: 1\n', { mode: 'create', entity: 'Board' });
    expect(store.isSelfWrite(uri, written.revision)).toBe(true);
    expect(store.isSelfWrite(uri, 'different')).toBe(false);
  });
});

describe('caches', () => {
  it('suppresses only matching self writes inside the window', () => {
    const registry = new WriteRegistry(100);
    registry.mark('file:///a', 'digest', 1000);
    expect(registry.shouldIgnore('file:///a', 'digest', 1050)).toBe(true);
    expect(registry.shouldIgnore('file:///a', 'other', 1050)).toBe(false);
    expect(registry.shouldIgnore('file:///a', 'digest', 1200)).toBe(false);
  });

  it('reuses parses only for the same digest', () => {
    const cache = new ParseCache<string>();
    cache.set('file:///a', 'one', 'parsed');
    expect(cache.get('file:///a', 'one')).toBe('parsed');
    expect(cache.get('file:///a', 'two')).toBeUndefined();
  });
});
