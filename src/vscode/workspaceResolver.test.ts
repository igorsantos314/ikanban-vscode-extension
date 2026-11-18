import { describe, expect, it, vi } from 'vitest';
import { WorkspaceNotAvailableError } from '../domain/errors';
import type { UriLike } from '../application/ports';
import {
  WorkspaceResolver,
  type WorkspaceFolderLike,
} from './workspaceResolver';

function folder(name: string): WorkspaceFolderLike {
  const uri: UriLike = {
    scheme: 'file',
    authority: '',
    path: `/${name}`,
    query: '',
    fragment: '',
    fsPath: `/${name}`,
    toString: () => `file:///${name}`,
  };
  return { name, uri };
}

describe('WorkspaceResolver', () => {
  it('rejects when no workspace folder is open', async () => {
    const resolver = new WorkspaceResolver({
      getFolders: () => [],
      pickFolder: vi.fn(),
      getRememberedUri: () => undefined,
      rememberUri: vi.fn(),
    });
    await expect(resolver.resolve()).rejects.toBeInstanceOf(WorkspaceNotAvailableError);
  });

  it('uses the only workspace folder without prompting', async () => {
    const only = folder('only');
    const pick = vi.fn();
    const resolver = new WorkspaceResolver({
      getFolders: () => [only],
      pickFolder: pick,
      getRememberedUri: () => undefined,
      rememberUri: vi.fn(),
    });
    expect(await resolver.resolve()).toBe(only);
    expect(pick).not.toHaveBeenCalled();
  });

  it('uses a remembered folder in a multi-root workspace', async () => {
    const first = folder('first');
    const second = folder('second');
    const pick = vi.fn();
    const resolver = new WorkspaceResolver({
      getFolders: () => [first, second],
      pickFolder: pick,
      getRememberedUri: () => second.uri.toString(),
      rememberUri: vi.fn(),
    });
    expect(await resolver.resolve()).toBe(second);
    expect(pick).not.toHaveBeenCalled();
  });

  it('prompts and remembers when the remembered folder is stale', async () => {
    const first = folder('first');
    const second = folder('second');
    const remember = vi.fn();
    const resolver = new WorkspaceResolver({
      getFolders: () => [first, second],
      pickFolder: async () => second,
      getRememberedUri: () => 'file:///gone',
      rememberUri: remember,
    });
    expect(await resolver.resolve()).toBe(second);
    expect(remember).toHaveBeenCalledWith(second.uri.toString());
  });

  it('returns undefined when the picker is cancelled', async () => {
    const resolver = new WorkspaceResolver({
      getFolders: () => [folder('a'), folder('b')],
      pickFolder: async () => undefined,
      getRememberedUri: () => undefined,
      rememberUri: vi.fn(),
    });
    expect(await resolver.resolve()).toBeUndefined();
  });

  it('forces a prompt for initialization', async () => {
    const first = folder('first');
    const second = folder('second');
    const pick = vi.fn(async () => first);
    const resolver = new WorkspaceResolver({
      getFolders: () => [first, second],
      pickFolder: pick,
      getRememberedUri: () => second.uri.toString(),
      rememberUri: vi.fn(),
    });
    expect(await resolver.resolve({ alwaysPick: true })).toBe(first);
    expect(pick).toHaveBeenCalledOnce();
  });
});
