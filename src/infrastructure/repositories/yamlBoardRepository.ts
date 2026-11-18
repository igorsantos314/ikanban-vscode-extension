import type {
  BoardRepository,
  DocumentReadResult,
  TaskFileRef,
  UriLike,
  WorkspaceFileSystem,
} from '../../application/ports';
import { DuplicateEntityError } from '../../domain/errors';
import type { BoardConfig, Column } from '../../domain/types';
import { YamlFileStore } from '../fs/yamlFileStore';
import { parseBoardDocument, parseColumnDocument, serializeBoardDocument, serializeColumnDocument } from '../yaml/codecs';
import { BOARD_FILE, COLUMN_FILE, assertSafeColumnId, isTaskFileName } from './layout';

export class YamlBoardRepository implements BoardRepository {
  readonly boardUri: UriLike;

  constructor(
    private readonly fs: WorkspaceFileSystem,
    private readonly store: YamlFileStore,
    readonly ikanbanUri: UriLike,
  ) {
    this.boardUri = fs.joinPath(ikanbanUri, BOARD_FILE);
  }

  async boardExists(): Promise<boolean> {
    return this.fs.exists(this.boardUri);
  }

  async isRootEmpty(): Promise<boolean> {
    if (!(await this.fs.exists(this.ikanbanUri))) {
      return true;
    }
    return (await this.store.list(this.ikanbanUri)).length === 0;
  }

  async ensureRoot(): Promise<void> {
    if (!(await this.fs.exists(this.ikanbanUri))) {
      await this.fs.createDirectory(this.ikanbanUri);
    }
  }

  async createBoard(board: BoardConfig): Promise<{ revision: string }> {
    await this.ensureRoot();
    return this.store.write(this.boardUri, serializeBoardDocument(board), {
      mode: 'create',
      entity: 'Board',
    });
  }

  async writeBoard(board: BoardConfig, expectedRevision: string): Promise<{ revision: string }> {
    const existing = await this.store.read(this.boardUri);
    return this.store.write(
      this.boardUri,
      serializeBoardDocument(board, existing?.raw),
      {
        mode: 'update',
        entity: 'Board',
        expectedRevision,
      },
    );
  }

  async readBoard(): Promise<DocumentReadResult<BoardConfig> | undefined> {
    const existing = await this.store.read(this.boardUri);
    if (!existing) {
      return undefined;
    }
    return parseBoardDocument(existing.raw, this.boardUri.toString());
  }

  async listColumnDirectories(): Promise<string[]> {
    if (!(await this.fs.exists(this.ikanbanUri))) {
      return [];
    }
    const entries = await this.store.list(this.ikanbanUri);
    return entries
      .filter((entry) => entry.type === 'directory' && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  }

  columnDirectory(columnId: string): UriLike {
    return this.fs.joinPath(this.ikanbanUri, assertSafeColumnId(columnId));
  }

  async columnExists(columnId: string): Promise<boolean> {
    return this.fs.exists(this.columnDirectory(columnId));
  }

  async createColumn(column: Column): Promise<{ revision: string }> {
    const directory = this.columnDirectory(column.id);
    if (await this.fs.exists(directory)) {
      throw new DuplicateEntityError('Column', column.id);
    }
    await this.fs.createDirectory(directory);
    try {
      return await this.store.write(
        this.fs.joinPath(directory, COLUMN_FILE),
        serializeColumnDocument(column),
        { mode: 'create', entity: 'Column' },
      );
    } catch (error) {
      await this.fs.delete(directory, { recursive: true }).catch(() => undefined);
      throw error;
    }
  }

  async writeColumn(column: Column, expectedRevision: string): Promise<{ revision: string }> {
    const uri = this.fs.joinPath(this.columnDirectory(column.id), COLUMN_FILE);
    const existing = await this.store.read(uri);
    return this.store.write(uri, serializeColumnDocument(column, existing?.raw), {
      mode: 'update',
      entity: 'Column',
      expectedRevision,
    });
  }

  async readColumn(columnId: string): Promise<DocumentReadResult<Column> | undefined> {
    const uri = this.fs.joinPath(this.columnDirectory(columnId), COLUMN_FILE);
    const existing = await this.store.read(uri);
    if (!existing) {
      return undefined;
    }
    return parseColumnDocument(existing.raw, uri.toString());
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.store.delete(this.columnDirectory(columnId), true);
  }

  async listTaskFiles(columnId: string): Promise<TaskFileRef[]> {
    const directory = this.columnDirectory(columnId);
    if (!(await this.fs.exists(directory))) {
      return [];
    }
    const entries = await this.store.list(directory);
    return entries
      .filter((entry) => entry.type === 'file' && isTaskFileName(entry.name))
      .map((entry) => ({
        columnId,
        fileName: entry.name,
        uri: this.fs.joinPath(directory, entry.name),
      }))
      .sort((left, right) => left.fileName.localeCompare(right.fileName));
  }
}
