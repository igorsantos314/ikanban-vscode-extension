import { describe, expect, it } from 'vitest';
import type { UriLike } from '../application/ports';
import {
  detectHomeState,
  peekWorkspaceFolder,
  type HomeStateDependencies,
  type StatKind,
} from './homeState';
import type { WorkspaceFolderLike } from './workspaceResolver';

const BUNDLED = '# skill\n';

function folder(name: string): WorkspaceFolderLike {
  return {
    name,
    uri: uri(`/${name}`),
  };
}

function uri(path: string): UriLike {
  return {
    scheme: 'file',
    authority: '',
    path,
    query: '',
    fragment: '',
    fsPath: path,
    toString: () => `file://${path}`,
  };
}

function joinPath(base: UriLike, ...segments: string[]): UriLike {
  return uri([base.path, ...segments].join('/').replace(/\/+/g, '/'));
}

interface Options {
  folders?: readonly WorkspaceFolderLike[];
  remembered?: string;
  trusted?: boolean;
  stats?: Record<string, StatKind>;
  entries?: Record<string, readonly string[]>;
  files?: Record<string, string>;
  bundled?: string;
  bundledError?: Error;
  readError?: Error;
}

function dependencies(options: Options = {}): HomeStateDependencies {
  const folders = options.folders ?? [folder('workspace')];
  return {
    getFolders: () => folders,
    getRememberedUri: () => options.remembered,
    isTrusted: () => options.trusted ?? true,
    joinPath,
    stat: async (target) => options.stats?.[target.path] ?? 'missing',
    listDirectory: async (target) => options.entries?.[target.path] ?? [],
    readText: async (target) => {
      if (options.readError) {
        throw options.readError;
      }
      return options.files?.[target.path];
    },
    readBundledSkill: async () => {
      if (options.bundledError) {
        throw options.bundledError;
      }
      return options.bundled ?? BUNDLED;
    },
  };
}

const BOARD = '/workspace/.ikanban/board.yaml';
const IKANBAN = '/workspace/.ikanban';
const SKILL = '/workspace/skills/ikanban/SKILL.md';

describe('peekWorkspaceFolder', () => {
  it('returns undefined with no folders', () => {
    expect(peekWorkspaceFolder({ getFolders: () => [], getRememberedUri: () => undefined })).toBe(
      undefined,
    );
  });

  it('returns the only folder', () => {
    const only = folder('only');
    expect(
      peekWorkspaceFolder({ getFolders: () => [only], getRememberedUri: () => undefined }),
    ).toBe(only);
  });

  it('returns the remembered folder in a multi-root workspace', () => {
    const first = folder('first');
    const second = folder('second');
    expect(
      peekWorkspaceFolder({
        getFolders: () => [first, second],
        getRememberedUri: () => second.uri.toString(),
      }),
    ).toBe(second);
  });

  it('returns undefined when multi-root has no remembered folder', () => {
    expect(
      peekWorkspaceFolder({
        getFolders: () => [folder('first'), folder('second')],
        getRememberedUri: () => undefined,
      }),
    ).toBe(undefined);
  });
});

describe('detectHomeState', () => {
  it('reports no workspace without writing anything', async () => {
    expect(await detectHomeState(dependencies({ folders: [] }))).toEqual({
      status: 'no-workspace',
      trusted: true,
    });
  });

  it('asks for a folder when a multi-root workspace has no remembered choice', async () => {
    const state = await detectHomeState(
      dependencies({ folders: [folder('first'), folder('second')] }),
    );
    expect(state.status).toBe('needs-selection');
    expect(state.board).toBeUndefined();
    expect(state.skill).toBeUndefined();
  });

  it('reports an initialized board and a current skill', async () => {
    const state = await detectHomeState(
      dependencies({
        stats: { [BOARD]: 'file', [IKANBAN]: 'directory' },
        files: { [SKILL]: BUNDLED },
      }),
    );
    expect(state).toEqual({
      status: 'ready',
      trusted: true,
      workspaceName: 'workspace',
      board: 'initialized',
      skill: 'current',
    });
  });

  it('reports a missing board and missing skill', async () => {
    const state = await detectHomeState(dependencies());
    expect(state.board).toBe('missing');
    expect(state.skill).toBe('missing');
  });

  it('distinguishes an incomplete .ikanban directory', async () => {
    const state = await detectHomeState(
      dependencies({
        stats: { [IKANBAN]: 'directory' },
        entries: { [IKANBAN]: ['backlog'] },
      }),
    );
    expect(state.board).toBe('needs-repair');
    expect(state.boardMessage).toContain('board.yaml');
  });

  it('treats an empty .ikanban directory as initializable', async () => {
    const state = await detectHomeState(
      dependencies({ stats: { [IKANBAN]: 'directory' }, entries: { [IKANBAN]: [] } }),
    );
    expect(state.board).toBe('missing');
  });

  it('reports a directory read failure', async () => {
    const deps = dependencies({ stats: { [IKANBAN]: 'directory' } });
    const state = await detectHomeState({
      ...deps,
      listDirectory: async () => 'error',
    });
    expect(state.board).toBe('error');
  });

  it('reports an outdated skill when the installed content differs', async () => {
    const state = await detectHomeState(
      dependencies({
        stats: { [BOARD]: 'file' },
        files: { [SKILL]: '# old skill\n' },
      }),
    );
    expect(state.skill).toBe('outdated');
  });

  it('reports board detection errors without treating the board as current', async () => {
    const state = await detectHomeState(
      dependencies({ stats: { [BOARD]: 'error' } }),
    );
    expect(state.board).toBe('error');
    expect(state.boardMessage).toBeTruthy();
  });

  it('reports a board path that is not a file', async () => {
    const state = await detectHomeState(
      dependencies({ stats: { [BOARD]: 'directory' } }),
    );
    expect(state.board).toBe('error');
    expect(state.boardMessage).toContain('not a file');
  });

  it('reports skill read failures', async () => {
    const state = await detectHomeState(
      dependencies({ readError: new Error('permission denied') }),
    );
    expect(state.skill).toBe('error');
    expect(state.skillMessage).toBeTruthy();
  });

  it('reports a bundled skill read failure', async () => {
    const state = await detectHomeState(
      dependencies({ bundledError: new Error('missing asset') }),
    );
    expect(state.skill).toBe('error');
    expect(state.skillMessage).toBeTruthy();
  });

  it('uses the remembered folder in a multi-root workspace', async () => {
    const second = folder('second');
    const state = await detectHomeState(
      dependencies({
        folders: [folder('first'), second],
        remembered: second.uri.toString(),
        stats: { '/second/.ikanban/board.yaml': 'file' },
        files: { '/second/skills/ikanban/SKILL.md': BUNDLED },
      }),
    );
    expect(state.workspaceName).toBe('second');
    expect(state.board).toBe('initialized');
  });

  it('reports the trust state without offering writes', async () => {
    const state = await detectHomeState(dependencies({ trusted: false }));
    expect(state.trusted).toBe(false);
  });
});
