import type {
  BoardRepository,
  DocumentReadResult,
  TaskFileRef,
  TaskRepository,
  WorkspaceFileSystem,
} from '../../application/ports';
import { ConflictError, EntityNotFoundError, StorageError } from '../../domain/errors';
import type { Task } from '../../domain/types';
import { YamlFileStore } from '../fs/yamlFileStore';
import { parseTaskDocument, serializeTaskDocument } from '../yaml/codecs';
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

  private ref(columnId: string, taskId: string): TaskFileRef {
    const safeColumn = assertSafeColumnId(columnId);
    const fileName = taskFileName(taskId);
    const directory = this.fs.joinPath(this.board.ikanbanUri, safeColumn);
    return { columnId: safeColumn, fileName, uri: this.fs.joinPath(directory, fileName) };
  }
}
