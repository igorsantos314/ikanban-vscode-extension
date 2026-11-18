import type { UriLike } from '../application/ports';
import type { WorkspaceFolderLike } from './workspaceResolver';
import { BoardService } from '../application/boardService';
import { VscodeWorkspaceFileSystem } from '../infrastructure/fs/vscodeFileSystem';
import { YamlFileStore } from '../infrastructure/fs/yamlFileStore';
import { YamlBoardRepository } from '../infrastructure/repositories/yamlBoardRepository';
import { YamlTaskRepository } from '../infrastructure/repositories/yamlTaskRepository';
import { SystemClock, UuidGenerator } from '../infrastructure/system';

export interface BoardSession {
  rootUri: UriLike;
  rootName: string;
  store: YamlFileStore;
  service: BoardService;
}

export function createBoardSession(folder: WorkspaceFolderLike): BoardSession {
  const fs = new VscodeWorkspaceFileSystem();
  const store = new YamlFileStore(fs);
  const ikanbanUri = fs.joinPath(folder.uri, '.ikanban');
  const board = new YamlBoardRepository(fs, store, ikanbanUri);
  const tasks = new YamlTaskRepository(fs, store, board);
  const service = new BoardService({
    board,
    tasks,
    clock: new SystemClock(),
    ids: new UuidGenerator(),
    workspaceName: folder.name,
  });
  return { rootUri: folder.uri, rootName: folder.name, store, service };
}
