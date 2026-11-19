import type {
  BoardRepository,
  Clock,
  DocumentReadResult,
  IdGenerator,
  TaskRepository,
} from './ports';
import { MutationQueue } from './mutationQueue';
import type {
  BoardSnapshot,
  ColumnView,
  TaskView,
} from '../shared/board';
import type { ValidationIssue } from '../shared/validationIssue';
import { deriveColumnId } from '../domain/columnId';
import { normalizeDueAt } from '../domain/deadline';
import {
  DuplicateEntityError,
  EntityNotFoundError,
  StorageError,
  ValidationError,
} from '../domain/errors';
import { normalizeTags } from '../domain/tags';
import { nextPosition, planReorder, sortByPosition } from '../domain/positions';
import type { Checklist, ChecklistItem, Column, Task } from '../domain/types';
import { requirePriority } from '../domain/types';
import {
  assertUniqueIds,
  assertUuid,
  normalizeRequiredText,
} from '../domain/validation';

const DEFAULT_COLUMNS: Column[] = [
  { id: 'backlog', title: 'Backlog', color: '#64748b' },
  { id: 'in-progress', title: 'In Progress', color: '#3b82f6' },
  { id: 'done', title: 'Done', color: '#22c55e' },
];

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export interface ChecklistItemDraft {
  id?: string;
  text: string;
  completed?: boolean;
}

export interface ChecklistDraft {
  id?: string;
  title: string;
  items?: ChecklistItemDraft[];
}

export interface TaskDraft {
  title: string;
  description?: string;
  priority: string;
  tags: readonly string[];
  checklists?: ChecklistDraft[];
  dueAt?: string | null;
}

export interface CreateTaskInput extends TaskDraft {
  columnId: string;
}

export interface UpdateTaskInput extends TaskDraft {
  taskId: string;
  columnId: string;
  expectedRevision: string;
}

export interface DeleteTaskInput {
  taskId: string;
  columnId: string;
  expectedRevision: string;
}

export interface MoveTaskInput {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  targetIndex: number;
  expectedRevision: string;
}

export interface CreateColumnInput {
  title: string;
  color: string;
  expectedBoardRevision: string;
}

export interface UpdateColumnInput {
  id: string;
  title: string;
  color: string;
  expectedRevision: string;
}

export interface DeleteColumnInput {
  id: string;
  expectedBoardRevision: string;
}

export interface ReorderColumnsInput {
  columnIds: string[];
  expectedBoardRevision: string;
}

export interface ChecklistOperationInput {
  taskId: string;
  columnId: string;
  expectedRevision: string;
}

export interface CreateChecklistInput extends ChecklistOperationInput {
  title: string;
}

export interface UpdateChecklistInput extends ChecklistOperationInput {
  checklistId: string;
  title: string;
}

export interface DeleteChecklistInput extends ChecklistOperationInput {
  checklistId: string;
}

export interface CreateChecklistItemInput extends ChecklistOperationInput {
  checklistId: string;
  text: string;
}

export interface UpdateChecklistItemInput extends ChecklistOperationInput {
  checklistId: string;
  itemId: string;
  text?: string;
  completed?: boolean;
}

export interface DeleteChecklistItemInput extends ChecklistOperationInput {
  checklistId: string;
  itemId: string;
}

export interface ToggleChecklistItemInput extends ChecklistOperationInput {
  checklistId: string;
  itemId: string;
}

export interface BoardServiceOptions {
  board: BoardRepository;
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
  workspaceName: string;
  queue?: MutationQueue;
}

export class BoardService {
  private readonly board: BoardRepository;
  private readonly tasks: TaskRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly workspaceName: string;
  private readonly queue: MutationQueue;

  constructor(options: BoardServiceOptions) {
    this.board = options.board;
    this.tasks = options.tasks;
    this.clock = options.clock;
    this.ids = options.ids;
    this.workspaceName = options.workspaceName;
    this.queue = options.queue ?? new MutationQueue();
  }

  initializeBoard(): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      if (await this.board.boardExists()) {
        return this.loadBoard();
      }

      await this.board.ensureRoot();
      if (!(await this.board.isRootEmpty())) {
        throw new StorageError(
          'The .ikanban directory exists without a board.yaml file. Repair or remove it before initializing.',
        );
      }

      const created: string[] = [];
      try {
        for (const column of DEFAULT_COLUMNS) {
          await this.board.createColumn(column);
          created.push(column.id);
        }
        await this.board.createBoard({
          version: 1,
          name: this.workspaceName,
          columnIds: DEFAULT_COLUMNS.map((column) => column.id),
        });
      } catch (error) {
        for (const id of created.reverse()) {
          await this.board.deleteColumn(id).catch(() => undefined);
        }
        throw error;
      }

      return this.loadBoard();
    });
  }

  async loadBoard(): Promise<BoardSnapshot> {
    if (!(await this.board.boardExists())) {
      const emptyRoot = await this.board.isRootEmpty();
      const issues: ValidationIssue[] = emptyRoot
        ? []
        : [
            {
              uri: this.board.boardUri.toString(),
              severity: 'error',
              code: 'schema/root',
              message: 'board.yaml is missing from a non-empty .ikanban directory.',
            },
          ];
      return {
        workspaceName: this.workspaceName,
        board: null,
        columns: [],
        tasks: [],
        issues,
        canInitialize: emptyRoot,
      };
    }

    let boardResult: DocumentReadResult<import('../domain/types').BoardConfig> | undefined;
    try {
      boardResult = await this.board.readBoard();
    } catch (error) {
      return this.emptyInvalidSnapshot([
        {
          uri: this.board.boardUri.toString(),
          severity: 'error',
          code: 'schema/root',
          message: `board.yaml could not be read: ${messageOf(error)}`,
        },
      ]);
    }
    if (!boardResult) {
      return this.emptyInvalidSnapshot([
        {
          uri: this.board.boardUri.toString(),
          severity: 'error',
          code: 'schema/root',
          message: 'board.yaml could not be read.',
        },
      ]);
    }
    if (!boardResult.ok) {
      return this.emptyInvalidSnapshot(boardResult.issues);
    }

    const config = boardResult.document.value;
    const issues: ValidationIssue[] = [];
    const columnViews: ColumnView[] = [];
    const taskEntries: Array<{ task: TaskView; uri: string }> = [];

    for (const columnId of config.columnIds) {
      if (!(await this.board.columnExists(columnId))) {
        issues.push({
          uri: this.board.boardUri.toString(),
          severity: 'error',
          code: 'board/missing-column',
          message: `The board references a missing column directory: ${columnId}.`,
          path: 'columns',
        });
        continue;
      }

      let columnResult: DocumentReadResult<Column> | undefined;
      try {
        columnResult = await this.board.readColumn(columnId);
      } catch (error) {
        issues.push({
          uri: this.board.boardUri.toString(),
          severity: 'error',
          code: 'board/missing-column-config',
          message: `Could not read column ${columnId}: ${messageOf(error)}`,
        });
        continue;
      }

      if (!columnResult) {
        issues.push({
          uri: this.board.boardUri.toString(),
          severity: 'error',
          code: 'board/missing-column-config',
          message: `The column directory ${columnId} has no column.yaml file.`,
        });
        continue;
      }
      if (!columnResult.ok) {
        issues.push(...columnResult.issues);
        continue;
      }
      if (columnResult.document.value.id !== columnId) {
        issues.push({
          uri: `${this.board.ikanbanUri.toString().replace(/\/$/, '')}/${columnId}/column.yaml`,
          severity: 'error',
          code: 'board/column-identity',
          message: `The column directory ${columnId} declares a different column ID: ${columnResult.document.value.id}.`,
          path: 'id',
        });
        continue;
      }

      const columnTasks: TaskView[] = [];
      let files: import('./ports').TaskFileRef[];
      try {
        files = await this.board.listTaskFiles(columnId);
      } catch (error) {
        issues.push({
          uri: `${this.board.ikanbanUri.toString().replace(/\/$/, '')}/${columnId}/column.yaml`,
          severity: 'error',
          code: 'board/missing-column-config',
          message: `Could not list tasks for column ${columnId}: ${messageOf(error)}`,
        });
        columnViews.push({
          ...columnResult.document.value,
          revision: columnResult.document.revision,
          taskCount: 0,
        });
        continue;
      }
      for (const file of files) {
        let parsed: DocumentReadResult<Task> | undefined;
        try {
          parsed = await this.tasks.readTask(file);
        } catch (error) {
          issues.push({
            uri: file.uri.toString(),
            severity: 'error',
            code: 'task/invalid-file',
            message: `Could not read task file: ${messageOf(error)}`,
          });
          continue;
        }
        if (!parsed) {
          issues.push({
            uri: file.uri.toString(),
            severity: 'error',
            code: 'task/missing-file',
            message: 'Task file disappeared while loading the board.',
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
        const view: TaskView = { ...task, revision: parsed.document.revision };
        taskEntries.push({ task: view, uri: file.uri.toString() });
        columnTasks.push(view);
      }

      columnViews.push({
        ...columnResult.document.value,
        revision: columnResult.document.revision,
        taskCount: columnTasks.length,
      });
    }

    const taskIds = new Set<string>();
    const duplicateIds = new Set<string>();
    for (const entry of taskEntries) {
      if (taskIds.has(entry.task.id)) {
        duplicateIds.add(entry.task.id);
      }
      taskIds.add(entry.task.id);
    }
    for (const entry of taskEntries) {
      if (duplicateIds.has(entry.task.id)) {
        issues.push({
          uri: entry.uri,
          severity: 'error',
          code: 'task/duplicate-id',
          message: `Duplicate task ID across the board: ${entry.task.id}.`,
          path: 'id',
        });
      }
    }

    const tasks = taskEntries
      .filter((entry) => !duplicateIds.has(entry.task.id))
      .map((entry) => entry.task);

    let directories: string[] = [];
    try {
      directories = await this.board.listColumnDirectories();
    } catch (error) {
      issues.push({
        uri: this.board.ikanbanUri.toString(),
        severity: 'warning',
        code: 'board/unreferenced-directory',
        message: `Could not list column directories: ${messageOf(error)}`,
      });
    }
    for (const directory of directories) {
      if (!config.columnIds.includes(directory)) {
        issues.push({
          uri: `${this.board.ikanbanUri.toString().replace(/\/$/, '')}/${directory}/column.yaml`,
          severity: 'warning',
          code: 'board/unreferenced-directory',
          message: `Column directory ${directory} is not referenced by board.yaml and is not shown.`,
        });
      }
    }

    for (const column of columnViews) {
      column.taskCount = tasks.filter((task) => task.columnId === column.id).length;
    }

    const sortedTasks = [...tasks].sort((left, right) => {
      if (left.columnId !== right.columnId) {
        return config.columnIds.indexOf(left.columnId) - config.columnIds.indexOf(right.columnId);
      }
      const sorted = sortByPosition([left, right]);
      return sorted[0]?.id === left.id ? -1 : 1;
    });

    return {
      workspaceName: this.workspaceName,
      board: { ...config, revision: boardResult.document.revision },
      columns: columnViews.sort(
        (left, right) => config.columnIds.indexOf(left.id) - config.columnIds.indexOf(right.id),
      ),
      tasks: sortedTasks,
      issues,
      canInitialize: false,
    };
  }

  validateBoard(): Promise<BoardSnapshot> {
    return this.loadBoard();
  }

  createColumn(input: CreateColumnInput): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      const { config, revision } = await this.requireBoard();
      const title = normalizeRequiredText(input.title, 'Column title');
      const color = this.validateColor(input.color);
      if (input.expectedBoardRevision !== revision) {
        throw new ValidationError(
          'The board configuration changed outside iKanban. Refresh before saving.',
        );
      }
      const id = deriveColumnId(title);
      if (config.columnIds.includes(id) || (await this.board.columnExists(id))) {
        throw new DuplicateEntityError('Column', id);
      }

      await this.board.createColumn({ id, title, color });
      try {
        await this.board.writeBoard(
          {
            ...config,
            columnIds: [...config.columnIds, id],
          },
          revision,
        );
      } catch (error) {
        await this.board.deleteColumn(id).catch(() => undefined);
        throw error;
      }
      return this.loadBoard();
    });
  }

  updateColumn(input: UpdateColumnInput): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      await this.requireBoard();
      const column = await this.requireColumn(input.id);
      const title = normalizeRequiredText(input.title, 'Column title');
      const color = this.validateColor(input.color);
      await this.board.writeColumn(
        { ...column.column, title, color },
        input.expectedRevision,
      );
      return this.loadBoard();
    });
  }

  deleteColumn(input: DeleteColumnInput): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      const { config, revision } = await this.requireBoard();
      if (input.expectedBoardRevision !== revision) {
        throw new ValidationError(
          'The board configuration changed outside iKanban. Refresh before saving.',
        );
      }
      const column = await this.requireColumn(input.id);
      if (config.columnIds.length === 1) {
        throw new ValidationError('A board must keep at least one column.');
      }
      const taskFiles = await this.board.listTaskFiles(column.column.id);
      if (taskFiles.length > 0) {
        throw new ValidationError(
          'This column cannot be deleted while it contains tasks. Move or delete its tasks first.',
        );
      }

      const nextConfig = {
        ...config,
        columnIds: config.columnIds.filter((id) => id !== column.column.id),
      };
      const writeResult = await this.board.writeBoard(nextConfig, revision);
      try {
        await this.board.deleteColumn(column.column.id);
      } catch (error) {
        await this.board.writeBoard(config, writeResult.revision).catch(() => undefined);
        throw new StorageError(
          'Could not delete the column directory. The board configuration was restored.',
          messageOf(error),
        );
      }
      return this.loadBoard();
    });
  }

  reorderColumns(input: ReorderColumnsInput): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      const { config, revision } = await this.requireBoard();
      if (input.expectedBoardRevision !== revision) {
        throw new ValidationError(
          'The board configuration changed outside iKanban. Refresh before saving.',
        );
      }
      const requested = input.columnIds;
      const unique = new Set(requested);
      if (
        requested.length !== config.columnIds.length ||
        unique.size !== requested.length ||
        requested.some((id) => !config.columnIds.includes(id))
      ) {
        throw new ValidationError('Column reorder must include every existing column exactly once.');
      }
      await this.board.writeBoard({ ...config, columnIds: requested }, revision);
      return this.loadBoard();
    });
  }

  createTask(input: CreateTaskInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { column } = await this.requireColumn(input.columnId);
      const existing = await this.tasksForColumn(column.id);
      const now = this.clock.now().toISOString();
      const dueAt = normalizeDueAt(input.dueAt);
      const task: Task = {
        id: this.ids.next(),
        title: normalizeRequiredText(input.title, 'Task title'),
        description: input.description ?? '',
        columnId: column.id,
        tags: normalizeTags(input.tags),
        priority: requirePriority(input.priority),
        position: nextPosition(existing),
        checklists: this.buildChecklists(input.checklists ?? []),
        ...(dueAt ? { dueAt } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const written = await this.tasks.createTask(task);
      return { ...task, revision: written.revision };
    });
  }

  updateTask(input: UpdateTaskInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const existing = await this.findTaskOrThrow(input.taskId);
      const targetColumn = await this.requireColumn(input.columnId);
      const now = this.clock.now().toISOString();
      const dueAt =
        input.dueAt === undefined
          ? existing.task.dueAt
          : normalizeDueAt(input.dueAt);
      const { dueAt: _existingDueAt, ...existingWithoutDueAt } = existing.task;
      const updated: Task = {
        ...existingWithoutDueAt,
        title: normalizeRequiredText(input.title, 'Task title'),
        description: input.description ?? '',
        tags: normalizeTags(input.tags),
        priority: requirePriority(input.priority),
        checklists:
          input.checklists === undefined
            ? existing.task.checklists
            : this.buildChecklists(input.checklists, existing.task.checklists),
        ...(dueAt ? { dueAt } : {}),
        updatedAt: now,
      };

      if (targetColumn.column.id === existing.task.columnId) {
        const written = await this.tasks.updateTask(updated, input.expectedRevision);
        return { ...updated, revision: written.revision };
      }

      const targetPosition = nextPosition(await this.tasksForColumn(targetColumn.column.id));
      const moved: Task = {
        ...updated,
        columnId: targetColumn.column.id,
        position: targetPosition,
      };
      const written = await this.tasks.moveTask(
        moved,
        existing.task.columnId,
        targetColumn.column.id,
        input.expectedRevision,
      );
      return { ...moved, revision: written.revision };
    });
  }

  deleteTask(input: DeleteTaskInput): Promise<void> {
    return this.queue.run(async () => {
      await this.tasks.deleteTask(input.columnId, input.taskId, input.expectedRevision);
    });
  }

  moveTask(input: MoveTaskInput): Promise<BoardSnapshot> {
    return this.queue.run(async () => {
      const source = await this.readTaskOrThrow(input.fromColumnId, input.taskId);
      const targetColumn = await this.requireColumn(input.toColumnId);
      const targetTasks = (await this.tasksForColumn(targetColumn.column.id)).filter(
        (task) => task.id !== input.taskId,
      );

      const planning = planReorder(
        [
          ...targetTasks,
          { ...source.task, position: Number.MAX_SAFE_INTEGER },
        ],
        source.task.id,
        input.targetIndex,
      );

      const changed: Array<{ previous: TaskView; revision: string }> = [];
      try {
        for (const [taskId, position] of Object.entries(planning.positions)) {
          if (taskId === input.taskId) {
            continue;
          }
          const task = targetTasks.find((candidate) => candidate.id === taskId);
          if (!task) {
            continue;
          }
          const updated = {
            ...task,
            position,
            updatedAt: this.clock.now().toISOString(),
          };
          const written = await this.tasks.updateTask(updated, task.revision);
          changed.push({ previous: task, revision: written.revision });
        }
      } catch (error) {
        for (const entry of changed.reverse()) {
          const restored = {
            ...entry.previous,
            updatedAt: this.clock.now().toISOString(),
          };
          await this.tasks.updateTask(restored, entry.revision).catch(() => undefined);
        }
        throw error;
      }

      const position = planning.positions[input.taskId] ?? nextPosition(targetTasks);
      const moved: Task = {
        ...source.task,
        columnId: targetColumn.column.id,
        position,
        updatedAt: this.clock.now().toISOString(),
      };

      if (source.task.columnId === targetColumn.column.id) {
        const written = await this.tasks.updateTask(moved, input.expectedRevision);
        void written;
      } else {
        await this.tasks.moveTask(
          moved,
          source.task.columnId,
          targetColumn.column.id,
          input.expectedRevision,
        );
      }
      return this.loadBoard();
    });
  }

  createChecklist(input: CreateChecklistInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist: Checklist = {
        id: this.ids.next(),
        title: normalizeRequiredText(input.title, 'Checklist title'),
        position: nextPosition(task.checklists),
        items: [],
      };
      return this.persistTask(
        { ...task, checklists: [...task.checklists, checklist] },
        revision,
      );
    });
  }

  updateChecklist(input: UpdateChecklistInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist = task.checklists.find((entry) => entry.id === input.checklistId);
      if (!checklist) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      const title = normalizeRequiredText(input.title, 'Checklist title');
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.map((entry) =>
            entry.id === input.checklistId ? { ...entry, title } : entry,
          ),
        },
        revision,
      );
    });
  }

  deleteChecklist(input: DeleteChecklistInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      if (!task.checklists.some((entry) => entry.id === input.checklistId)) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.filter((entry) => entry.id !== input.checklistId),
        },
        revision,
      );
    });
  }

  createChecklistItem(input: CreateChecklistItemInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist = task.checklists.find((entry) => entry.id === input.checklistId);
      if (!checklist) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      const item: ChecklistItem = {
        id: this.ids.next(),
        text: normalizeRequiredText(input.text, 'Checklist item text'),
        completed: false,
        position: nextPosition(checklist.items),
      };
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.map((entry) =>
            entry.id === input.checklistId
              ? { ...entry, items: [...entry.items, item] }
              : entry,
          ),
        },
        revision,
      );
    });
  }

  updateChecklistItem(input: UpdateChecklistItemInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist = task.checklists.find((entry) => entry.id === input.checklistId);
      if (!checklist) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      const item = checklist.items.find((entry) => entry.id === input.itemId);
      if (!item) {
        throw new EntityNotFoundError('Checklist item', input.itemId);
      }
      const text =
        input.text === undefined
          ? item.text
          : normalizeRequiredText(input.text, 'Checklist item text');
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.map((entry) =>
            entry.id === input.checklistId
              ? {
                  ...entry,
                  items: entry.items.map((candidate) =>
                    candidate.id === input.itemId
                      ? {
                          ...candidate,
                          text,
                          completed: input.completed ?? candidate.completed,
                        }
                      : candidate,
                  ),
                }
              : entry,
          ),
        },
        revision,
      );
    });
  }

  deleteChecklistItem(input: DeleteChecklistItemInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist = task.checklists.find((entry) => entry.id === input.checklistId);
      if (!checklist) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      if (!checklist.items.some((entry) => entry.id === input.itemId)) {
        throw new EntityNotFoundError('Checklist item', input.itemId);
      }
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.map((entry) =>
            entry.id === input.checklistId
              ? {
                  ...entry,
                  items: entry.items.filter((candidate) => candidate.id !== input.itemId),
                }
              : entry,
          ),
        },
        revision,
      );
    });
  }

  toggleChecklistItem(input: ToggleChecklistItemInput): Promise<TaskView> {
    return this.queue.run(async () => {
      const { task, revision } = await this.readTaskOrThrow(input.columnId, input.taskId);
      const checklist = task.checklists.find((entry) => entry.id === input.checklistId);
      if (!checklist) {
        throw new EntityNotFoundError('Checklist', input.checklistId);
      }
      const item = checklist.items.find((entry) => entry.id === input.itemId);
      if (!item) {
        throw new EntityNotFoundError('Checklist item', input.itemId);
      }
      return this.persistTask(
        {
          ...task,
          checklists: task.checklists.map((entry) =>
            entry.id === input.checklistId
              ? {
                  ...entry,
                  items: entry.items.map((candidate) =>
                    candidate.id === input.itemId
                      ? { ...candidate, completed: !candidate.completed }
                      : candidate,
                  ),
                }
              : entry,
          ),
        },
        revision,
      );
    });
  }

  private async persistTask(task: Task, revision: string): Promise<TaskView> {
    const updated = { ...task, updatedAt: this.clock.now().toISOString() };
    const written = await this.tasks.updateTask(updated, revision);
    return { ...updated, revision: written.revision };
  }

  private async findTaskOrThrow(taskId: string): Promise<{ task: Task; revision: string }> {
    const result = await this.board.readBoard();
    if (!result) {
      throw new EntityNotFoundError('Board', 'board.yaml');
    }
    if (!result.ok) {
      throw new ValidationError('The board configuration is invalid and cannot be changed.');
    }
    for (const columnId of result.document.value.columnIds) {
      const parsed = await this.tasks.readTaskById(columnId, taskId);
      if (!parsed) {
        continue;
      }
      if (!parsed.ok) {
        throw new ValidationError(
          `Task ${taskId} cannot be changed because its YAML file is invalid.`,
          parsed.issues.map((issue) => issue.message).join('\n'),
        );
      }
      return { task: parsed.document.value, revision: parsed.document.revision };
    }
    throw new EntityNotFoundError('Task', taskId);
  }

  private async readTaskOrThrow(
    columnId: string,
    taskId: string,
  ): Promise<{ task: Task; revision: string }> {
    const parsed = await this.tasks.readTaskById(columnId, taskId);
    if (!parsed) {
      throw new EntityNotFoundError('Task', taskId);
    }
    if (!parsed.ok) {
      throw new ValidationError(
        `Task ${taskId} cannot be changed because its YAML file is invalid.`,
        parsed.issues.map((issue) => issue.message).join('\n'),
      );
    }
    return { task: parsed.document.value, revision: parsed.document.revision };
  }

  private async requireBoard(): Promise<{
    config: { version: 1; name: string; columnIds: string[] };
    revision: string;
  }> {
    const result = await this.board.readBoard();
    if (!result) {
      throw new EntityNotFoundError('Board', 'board.yaml');
    }
    if (!result.ok) {
      throw new ValidationError(
        'The board configuration is invalid and cannot be changed.',
        result.issues.map((issue) => issue.message).join('\n'),
      );
    }
    return { config: result.document.value, revision: result.document.revision };
  }

  private async requireColumn(
    columnId: string,
  ): Promise<{ column: Column; revision: string }> {
    const { config } = await this.requireBoard();
    if (!config.columnIds.includes(columnId)) {
      throw new ValidationError('The selected column no longer exists.');
    }
    const result = await this.board.readColumn(columnId);
    if (!result) {
      throw new ValidationError('The selected column no longer exists.');
    }
    if (!result.ok) {
      throw new ValidationError(
        `The selected column is invalid: ${result.issues[0]?.message ?? 'unknown error'}`,
      );
    }
    return { column: result.document.value, revision: result.document.revision };
  }

  private async tasksForColumn(columnId: string): Promise<TaskView[]> {
    const files = await this.board.listTaskFiles(columnId);
    const tasks: TaskView[] = [];
    for (const file of files) {
      const parsed = await this.tasks.readTask(file).catch(() => undefined);
      if (!parsed?.ok) {
        continue;
      }
      if (file.fileName !== `${parsed.document.value.id}.yaml`) {
        continue;
      }
      tasks.push({ ...parsed.document.value, revision: parsed.document.revision });
    }
    return sortByPosition(tasks);
  }

  private buildChecklists(
    drafts: readonly ChecklistDraft[],
    existing: readonly Checklist[] = [],
  ): Checklist[] {
    const checklistIds: string[] = [];
    const checklists = drafts.map((draft, checklistIndex) => {
      const id = draft.id ? assertUuid(draft.id, 'Checklist ID') : this.ids.next();
      checklistIds.push(id);
      const existingChecklist = existing.find((entry) => entry.id === id);
      const items = (draft.items ?? []).map((item, itemIndex) => {
        const itemId = item.id ? assertUuid(item.id, 'Checklist item ID') : this.ids.next();
        const existingItem = existingChecklist?.items.find((entry) => entry.id === itemId);
        return {
          id: itemId,
          text: normalizeRequiredText(item.text, 'Checklist item text'),
          completed: item.completed ?? existingItem?.completed ?? false,
          position: (itemIndex + 1) * 1024,
        };
      });
      assertUniqueIds(
        items.map((item) => item.id),
        'checklist item ID',
      );
      return {
        id,
        title: normalizeRequiredText(draft.title, 'Checklist title'),
        position: (checklistIndex + 1) * 1024,
        items,
      };
    });
    assertUniqueIds(checklistIds, 'checklist ID');
    return checklists;
  }

  private validateColor(color: string): string {
    if (!COLOR_PATTERN.test(color)) {
      throw new ValidationError(
        'Column color must be a six-digit hexadecimal value such as #64748b.',
      );
    }
    return color;
  }

  private emptyInvalidSnapshot(issues: ValidationIssue[]): BoardSnapshot {
    return {
      workspaceName: this.workspaceName,
      board: null,
      columns: [],
      tasks: [],
      issues,
      canInitialize: false,
    };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
