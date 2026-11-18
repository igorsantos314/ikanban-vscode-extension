import type { BoardConfig, Column, Task } from '../domain/types';

export interface UriLike {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;
  toString(): string;
}

export type FileType = 'file' | 'directory' | 'unknown';

export interface DirectoryEntry {
  name: string;
  type: FileType;
}

export interface FileStat {
  type: FileType;
  size: number;
  mtime: number;
}

export interface WorkspaceFileSystem {
  readFile(uri: UriLike): Promise<Uint8Array>;
  writeFile(uri: UriLike, content: Uint8Array): Promise<void>;
  delete(uri: UriLike, options?: { recursive?: boolean }): Promise<void>;
  createDirectory(uri: UriLike): Promise<void>;
  readDirectory(uri: UriLike): Promise<DirectoryEntry[]>;
  stat(uri: UriLike): Promise<FileStat>;
  exists(uri: UriLike): Promise<boolean>;
  rename(source: UriLike, target: UriLike, options?: { overwrite?: boolean }): Promise<void>;
  joinPath(base: UriLike, ...segments: string[]): UriLike;
  dirname(uri: UriLike): UriLike;
  basename(uri: UriLike): string;
}

export interface ParsedDocument<T> {
  value: T;
  revision: string;
  raw: string;
}

export type DocumentReadResult<T> =
  | { ok: true; document: ParsedDocument<T> }
  | { ok: false; issues: import('../shared/validationIssue').ValidationIssue[] };

export interface TaskFileRef {
  columnId: string;
  fileName: string;
  uri: UriLike;
}

export interface BoardRepository {
  readonly ikanbanUri: UriLike;
  readonly boardUri: UriLike;

  boardExists(): Promise<boolean>;
  isRootEmpty(): Promise<boolean>;
  ensureRoot(): Promise<void>;
  createBoard(board: BoardConfig): Promise<{ revision: string }>;
  writeBoard(board: BoardConfig, expectedRevision: string): Promise<{ revision: string }>;
  readBoard(): Promise<DocumentReadResult<BoardConfig> | undefined>;

  listColumnDirectories(): Promise<string[]>;
  columnExists(columnId: string): Promise<boolean>;
  createColumn(column: Column): Promise<{ revision: string }>;
  writeColumn(column: Column, expectedRevision: string): Promise<{ revision: string }>;
  readColumn(columnId: string): Promise<DocumentReadResult<Column> | undefined>;
  deleteColumn(columnId: string): Promise<void>;

  listTaskFiles(columnId: string): Promise<TaskFileRef[]>;
}

export interface TaskRepository {
  listTaskFiles(columnId: string): Promise<TaskFileRef[]>;
  readTask(ref: TaskFileRef): Promise<DocumentReadResult<Task> | undefined>;
  readTaskById(columnId: string, taskId: string): Promise<DocumentReadResult<Task> | undefined>;
  createTask(task: Task): Promise<{ revision: string }>;
  updateTask(task: Task, expectedRevision: string): Promise<{ revision: string }>;
  deleteTask(columnId: string, taskId: string, expectedRevision: string): Promise<void>;
  moveTask(
    task: Task,
    fromColumnId: string,
    toColumnId: string,
    expectedRevision: string,
  ): Promise<{ revision: string }>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
