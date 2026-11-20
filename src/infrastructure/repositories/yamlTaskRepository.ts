import { randomUUID } from 'node:crypto';
import type {
  BoardRepository,
  ColumnIndexResult,
  DocumentReadResult,
  TaskFileRef,
  TaskPageResult,
  TaskRepository,
  WorkspaceFileSystem,
} from '../../application/ports';
import type { ColumnTaskIndex, TaskIndexEntry } from '../../application/taskPagination';
import {
  clampPageSize,
  selectPage,
  sortIndexEntries,
  type IndexedFileMetadata,
} from '../../application/taskPagination';
import { ConflictError, EntityNotFoundError, PaginationConflictError, StorageError } from '../../domain/errors';
import type { Task } from '../../domain/types';
import type { TaskCursor } from '../../shared/board';
import type { ValidationIssue } from '../../shared/validationIssue';
import { YamlFileStore } from '../fs/yamlFileStore';
import { parseTaskDocument, revisionOf, serializeTaskDocument } from '../yaml/codecs';
import { assertSafeColumnId, taskFileName } from './layout';

export class YamlTaskRepository implements TaskRepository {
  constructor(
    private readonly fs: WorkspaceFileSystem,
    private readonly store: YamlFileStore,
    private readonly board: BoardRepository,
  ) {}

  listTaskFiles(columnId: string): Promise<TaskFileRef[]> {
    return this.board.listTaskFiles(columnId);
  }

  async readTask(ref: TaskFileRef): Promise<DocumentReadResult<Task> | undefined> {
    const existing = await this.store.read(ref.uri);
    if (!existing) {
      return undefined;
    }
    return parseTaskDocument(existing.raw, ref.uri.toString(), ref.columnId);
  }

  async readTaskById(
    columnId: string,
    taskId: string,
  ): Promise<DocumentReadResult<Task> | undefined> {
    return this.readTask(this.ref(columnId, taskId));
  }

  async createTask(task: Task): Promise<{ revision: string }> {
    const ref = this.ref(task.columnId, task.id);
    return this.store.write(ref.uri, serializeTaskDocument(task), {
      mode: 'create',
      entity: 'Task',
    });
  }

  async updateTask(task: Task, expectedRevision: string): Promise<{ revision: string }> {
    const ref = this.ref(task.columnId, task.id);
    const existing = await this.store.read(ref.uri);
    if (!existing) {
      throw new EntityNotFoundError('Task', task.id);
    }
    if (existing.revision !== expectedRevision) {
      throw new ConflictError('Task');
    }
    const content = serializeTaskDocument(task, existing.raw);
    return this.store.write(ref.uri, content, {
      mode: 'update',
      entity: 'Task',
      expectedRevision,
    });
  }

  async deleteTask(columnId: string, taskId: string, expectedRevision: string): Promise<void> {
    const ref = this.ref(columnId, taskId);
    const existing = await this.store.read(ref.uri);
    if (!existing) {
      throw new EntityNotFoundError('Task', taskId);
    }
    if (existing.revision !== expectedRevision) {
      throw new ConflictError('Task');
    }
    await this.store.delete(ref.uri);
  }

  async moveTask(
    task: Task,
    fromColumnId: string,
    toColumnId: string,
    expectedRevision: string,
  ): Promise<{ revision: string }> {
    const source = this.ref(fromColumnId, task.id);
    const target = this.ref(toColumnId, task.id);
    const existing = await this.store.read(source.uri);
    if (!existing) {
      throw new EntityNotFoundError('Task', task.id);
    }
    if (existing.revision !== expectedRevision) {
      throw new ConflictError('Task');
    }

    const movedTask: Task = { ...task, columnId: toColumnId };
    const content = serializeTaskDocument(movedTask, existing.raw);
    const result = await this.store.write(target.uri, content, {
      mode: 'create',
      entity: 'Task',
    });

    try {
      await this.store.delete(source.uri);
    } catch (error) {
      await this.store.delete(target.uri).catch(() => undefined);
      throw new StorageError(
        'Could not complete the task move. The task remains in its original column.',
        error instanceof Error ? error.message : String(error),
      );
    }

    return result;
  }

  async invalidateColumnIndex(columnId: string): Promise<void> {
    const uri = this.indexUri(columnId);
    try {
      if (await this.fs.exists(uri)) {
        await this.fs.delete(uri);
      }
    } catch {
      // A failed invalidation only forces a rebuild later.
    }
  }

  async invalidateAllIndexes(): Promise<void> {
    const directory = this.indexDirectory();
    try {
      if (!(await this.fs.exists(directory))) {
        return;
      }
      for (const entry of await this.fs.readDirectory(directory)) {
        if (entry.type === 'file' && entry.name.endsWith('.json')) {
          await this.fs.delete(this.fs.joinPath(directory, entry.name)).catch(() => undefined);
        }
      }
    } catch {
      // Indexes are derived; a failed cleanup is safe.
    }
  }

  async ensureColumnIndex(columnId: string): Promise<ColumnIndexResult> {
    const safeColumn = assertSafeColumnId(columnId);
    const files = await this.listTaskFiles(safeColumn);
    const existing = await this.readIndex(safeColumn);
    if (existing && (await this.indexMatchesDirectory(existing, files))) {
      return { index: existing, issues: [], rebuilt: false };
    }
    return this.rebuildIndex(safeColumn, files);
  }

  async readTaskPage(
    columnId: string,
    cursor: TaskCursor | null,
    limit: number,
    expectedRevision: string,
  ): Promise<TaskPageResult> {
    const safeColumn = assertSafeColumnId(columnId);
    let ensured = await this.ensureColumnIndex(safeColumn);
    if (ensured.index.tasksRevision !== expectedRevision) {
      throw new PaginationConflictError();
    }
    this.assertCursorExists(ensured.index, cursor);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const page = selectPage(ensured.index.entries, cursor, clampPageSize(limit));
      const tasks: TaskPageResult['tasks'] = [];
      const issues: ValidationIssue[] = [];
      let invalid = false;

      for (const entry of page.entries) {
        const ref = this.ref(safeColumn, entry.id);
        let parsed: DocumentReadResult<Task> | undefined;
        try {
          parsed = await this.readTask(ref);
        } catch (error) {
          invalid = true;
          issues.push({
            uri: ref.uri.toString(),
            severity: 'error',
            code: 'task/invalid-file',
            message: `Could not read task file: ${error instanceof Error ? error.message : String(error)}`,
          });
          continue;
        }
        if (!parsed) {
          invalid = true;
          issues.push({
            uri: ref.uri.toString(),
            severity: 'error',
            code: 'task/missing-file',
            message: 'Task file disappeared while loading a page.',
          });
          continue;
        }
        if (!parsed.ok) {
          invalid = true;
          issues.push(...parsed.issues);
          continue;
        }
        if (ref.fileName !== `${parsed.document.value.id}.yaml`) {
          invalid = true;
          issues.push({
            uri: ref.uri.toString(),
            severity: 'error',
            code: 'task/identity-mismatch',
            message: `Task file name ${ref.fileName} does not match task ID ${parsed.document.value.id}.`,
          });
          continue;
        }
        tasks.push({
          task: parsed.document.value,
          revision: parsed.document.revision,
          uri: ref.uri.toString(),
        });
      }

      if (!invalid || attempt === 1) {
        return {
          tasks,
          issues,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          taskCount: ensured.index.entries.length,
          tasksRevision: ensured.index.tasksRevision,
        };
      }

      const files = await this.listTaskFiles(safeColumn);
      ensured = await this.rebuildIndex(safeColumn, files);
      this.assertCursorExists(ensured.index, cursor);
    }

    throw new PaginationConflictError();
  }

  private indexDirectory() {
    return this.fs.joinPath(this.board.ikanbanUri, '.index');
  }

  private indexUri(columnId: string) {
    return this.fs.joinPath(this.indexDirectory(), `${assertSafeColumnId(columnId)}.json`);
  }

  private async readIndex(columnId: string): Promise<ColumnTaskIndex | undefined> {
    const uri = this.indexUri(columnId);
    try {
      if (!(await this.fs.exists(uri))) {
        return undefined;
      }
      const raw = new TextDecoder().decode(await this.fs.readFile(uri));
      const parsed = JSON.parse(raw) as Partial<ColumnTaskIndex>;
      if (
        parsed.version !== 1 ||
        parsed.columnId !== columnId ||
        typeof parsed.tasksRevision !== 'string' ||
        !Array.isArray(parsed.entries) ||
        !Array.isArray(parsed.sourceFiles)
      ) {
        return undefined;
      }
      return parsed as ColumnTaskIndex;
    } catch {
      return undefined;
    }
  }

  private async indexMatchesDirectory(
    index: ColumnTaskIndex,
    files: TaskFileRef[],
  ): Promise<boolean> {
    if (index.sourceFiles.length !== files.length) {
      return false;
    }
    const byName = new Map(index.sourceFiles.map((entry) => [entry.fileName, entry]));
    for (const file of files) {
      const indexed = byName.get(file.fileName);
      if (!indexed) {
        return false;
      }
      try {
        const stat = await this.fs.stat(file.uri);
        if (stat.size !== indexed.size || stat.mtime !== indexed.mtime) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  private async rebuildIndex(
    columnId: string,
    files: TaskFileRef[],
  ): Promise<ColumnIndexResult> {
    const issues: ValidationIssue[] = [];
    const sourceFiles: IndexedFileMetadata[] = [];
    const entries: TaskIndexEntry[] = [];

    for (const file of files) {
      let size = 0;
      let mtime = 0;
      try {
        const stat = await this.fs.stat(file.uri);
        size = stat.size;
        mtime = stat.mtime;
      } catch (error) {
        issues.push({
          uri: file.uri.toString(),
          severity: 'error',
          code: 'task/missing-file',
          message: `Could not stat task file: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      sourceFiles.push({ fileName: file.fileName, size, mtime });

      let parsed: DocumentReadResult<Task> | undefined;
      try {
        parsed = await this.readTask(file);
      } catch (error) {
        issues.push({
          uri: file.uri.toString(),
          severity: 'error',
          code: 'task/invalid-file',
          message: `Could not read task file: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      if (!parsed) {
        issues.push({
          uri: file.uri.toString(),
          severity: 'error',
          code: 'task/missing-file',
          message: 'Task file disappeared while indexing the column.',
        });
        continue;
      }
      if (!parsed.ok) {
        issues.push(...parsed.issues);
        continue;
      }
      const task = parsed.document.value;
      if (file.fileName !== `${task.id}.yaml`) {
        issues.push({
          uri: file.uri.toString(),
          severity: 'error',
          code: 'task/identity-mismatch',
          message: `Task file name ${file.fileName} does not match task ID ${task.id}.`,
        });
        continue;
      }
      entries.push({
        id: task.id,
        position: task.position,
        fileName: file.fileName,
        size,
        mtime,
      });
    }

    const sortedEntries = sortIndexEntries(entries);
    const sortedFiles = [...sourceFiles].sort((left, right) =>
      left.fileName.localeCompare(right.fileName),
    );
    const index: ColumnTaskIndex = {
      version: 1,
      columnId,
      tasksRevision: revisionOf(JSON.stringify({ sourceFiles: sortedFiles, entries: sortedEntries })),
      sourceFiles: sortedFiles,
      entries: sortedEntries,
    };
    await this.writeIndex(index);
    return { index, issues, rebuilt: true };
  }

  private async writeIndex(index: ColumnTaskIndex): Promise<void> {
    const directory = this.indexDirectory();
    if (!(await this.fs.exists(directory))) {
      await this.fs.createDirectory(directory);
    }
    const uri = this.indexUri(index.columnId);
    const temp = this.fs.joinPath(
      directory,
      `.${index.columnId}.${randomUUID()}.tmp`,
    );
    const bytes = new TextEncoder().encode(JSON.stringify(index, null, 2));
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
      throw new StorageError('Could not write the task index.', String(error));
    }
  }

  private assertCursorExists(index: ColumnTaskIndex, cursor: TaskCursor | null): void {
    if (!cursor) {
      return;
    }
    if (
      !index.entries.some(
        (entry) => entry.id === cursor.taskId && entry.position === cursor.position,
      )
    ) {
      throw new PaginationConflictError();
    }
  }

  private ref(columnId: string, taskId: string): TaskFileRef {
    const safeColumn = assertSafeColumnId(columnId);
    const fileName = taskFileName(taskId);
    const directory = this.fs.joinPath(this.board.ikanbanUri, safeColumn);
    return { columnId: safeColumn, fileName, uri: this.fs.joinPath(directory, fileName) };
  }
}
