import type { UriLike } from '../application/ports';
import {
  SKILL_DIRECTORY,
  SKILL_FILE_NAME,
} from '../application/agentSkill';
import { BOARD_FILE } from '../infrastructure/repositories/layout';
import type { WorkspaceFolderLike } from './workspaceResolver';

export const IKANBAN_DIRECTORY = '.ikanban';

export type HomeBoardState = 'initialized' | 'missing' | 'needs-repair' | 'error';
export type HomeSkillState = 'missing' | 'current' | 'outdated' | 'error';
export type HomeViewStatus = 'loading' | 'no-workspace' | 'needs-selection' | 'ready' | 'error';

export interface HomeViewState {
  status: HomeViewStatus;
  trusted: boolean;
  workspaceName?: string;
  board?: HomeBoardState;
  boardMessage?: string;
  skill?: HomeSkillState;
  skillMessage?: string;
  errorMessage?: string;
}

export type StatKind = 'file' | 'directory' | 'missing' | 'error';

export interface HomeStateDependencies {
  getFolders(): readonly WorkspaceFolderLike[];
  getRememberedUri(): string | undefined;
  isTrusted(): boolean;
  joinPath(base: UriLike, ...segments: string[]): UriLike;
  stat(uri: UriLike): Promise<StatKind>;
  listDirectory(uri: UriLike): Promise<readonly string[] | 'error'>;
  readText(uri: UriLike): Promise<string | undefined>;
  readBundledSkill(): Promise<string>;
}

export function peekWorkspaceFolder(
  dependencies: Pick<HomeStateDependencies, 'getFolders' | 'getRememberedUri'>,
): WorkspaceFolderLike | undefined {
  const folders = dependencies.getFolders();
  if (folders.length === 0) {
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const remembered = dependencies.getRememberedUri();
  return remembered
    ? folders.find((folder) => folder.uri.toString() === remembered)
    : undefined;
}

export async function detectHomeState(
  dependencies: HomeStateDependencies,
): Promise<HomeViewState> {
  const trusted = dependencies.isTrusted();
  const folders = dependencies.getFolders();
  if (folders.length === 0) {
    return { status: 'no-workspace', trusted };
  }

  const folder = peekWorkspaceFolder(dependencies);
  if (!folder) {
    return { status: 'needs-selection', trusted };
  }

  const state: HomeViewState = {
    status: 'ready',
    trusted,
    workspaceName: folder.name,
  };

  try {
    const board = await detectBoardState(dependencies, folder);
    state.board = board.state;
    if (board.message) {
      state.boardMessage = board.message;
    }
  } catch {
    state.board = 'error';
    state.boardMessage = 'The board state could not be read.';
  }

  try {
    const skill = await detectSkillState(dependencies, folder);
    state.skill = skill.state;
    if (skill.message) {
      state.skillMessage = skill.message;
    }
  } catch {
    state.skill = 'error';
    state.skillMessage = 'The AI skill state could not be read.';
  }

  return state;
}

interface Detection<T extends string> {
  state: T;
  message?: string;
}

async function detectBoardState(
  dependencies: HomeStateDependencies,
  folder: WorkspaceFolderLike,
): Promise<Detection<HomeBoardState>> {
  const ikanbanUri = dependencies.joinPath(folder.uri, IKANBAN_DIRECTORY);
  const boardUri = dependencies.joinPath(ikanbanUri, BOARD_FILE);
  const board = await dependencies.stat(boardUri);

  if (board === 'file') {
    return { state: 'initialized' };
  }
  if (board === 'error') {
    return { state: 'error', message: 'The board state could not be read.' };
  }
  if (board === 'directory') {
    return {
      state: 'error',
      message: `${BOARD_FILE} is not a file. Repair the board directory.`,
    };
  }

  const directory = await dependencies.stat(ikanbanUri);
  if (directory === 'directory') {
    const entries = await dependencies.listDirectory(ikanbanUri);
    if (entries === 'error') {
      return { state: 'error', message: 'The board state could not be read.' };
    }
    if (entries.length === 0) {
      return { state: 'missing' };
    }
    return {
      state: 'needs-repair',
      message: `${IKANBAN_DIRECTORY} exists without ${BOARD_FILE}.`,
    };
  }
  if (directory === 'error') {
    return { state: 'error', message: 'The board state could not be read.' };
  }
  return { state: 'missing' };
}

async function detectSkillState(
  dependencies: HomeStateDependencies,
  folder: WorkspaceFolderLike,
): Promise<Detection<HomeSkillState>> {
  const skillUri = dependencies.joinPath(
    folder.uri,
    ...SKILL_DIRECTORY,
    SKILL_FILE_NAME,
  );
  const bundled = await dependencies.readBundledSkill();
  const installed = await dependencies.readText(skillUri);

  if (installed === undefined) {
    return { state: 'missing' };
  }
  return { state: installed === bundled ? 'current' : 'outdated' };
}
