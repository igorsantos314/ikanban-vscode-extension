import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, DuplicateEntityError, StorageError, ValidationError } from '../domain/errors';
import { getChecklistProgress } from '../domain/checklist';
import type { BoardSnapshot } from '../shared/board';
import {
  createTestWorkspace,
  FaultyFileSystem,
  FixedClock,
  SequenceIdGenerator,
  type TestWorkspace,
} from '../test/helpers/workspace';
import { YamlFileStore } from '../infrastructure/fs/yamlFileStore';
import { YamlBoardRepository } from '../infrastructure/repositories/yamlBoardRepository';
import { YamlTaskRepository } from '../infrastructure/repositories/yamlTaskRepository';
import {
  BoardService,
  type CreateTaskInput,
} from './boardService';

const workspaces: TestWorkspace[] = [];
const services: BoardService[] = [];

afterEach(async () => {
  while (workspaces.length > 0) {
    await workspaces.pop()?.cleanup();
  }
});

async function setup(): Promise<{
  workspace: TestWorkspace;
  service: BoardService;
  clock: FixedClock;
}> {
  const workspace = await createTestWorkspace();
  workspaces.push(workspace);
  const clock = new FixedClock();
  const service = new BoardService({
    board: workspace.board,
    tasks: workspace.tasks,
    clock,
    ids: new SequenceIdGenerator(),
    workspaceName: 'Test Workspace',
  });
  services.push(service);
  await service.initializeBoard();
  return { workspace, service, clock };
}

function taskInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    columnId: 'backlog',
    title: 'Task',
    description: '',
    priority: 'medium',
    tags: [],
    checklists: [],
    ...overrides,
  };
}

function column(snapshot: BoardSnapshot, id: string) {
  return snapshot.columns.find((entry) => entry.id === id);
}

async function writeBoard(workspace: TestWorkspace, content: string) {
  await workspace.fs.writeFile(
    workspace.board.boardUri,
    new TextEncoder().encode(content),
  );
}

describe('InitializeBoard', () => {
  it('creates the default board', async () => {
    const workspace = await createTestWorkspace();
    workspaces.push(workspace);
    const service = new BoardService({
      board: workspace.board,
      tasks: workspace.tasks,
      clock: new FixedClock(),
      ids: new SequenceIdGenerator(),
      workspaceName: 'My Project',
    });
    const snapshot = await service.initializeBoard();
    expect(snapshot.board?.name).toBe('My Project');
    expect(snapshot.columns.map((entry) => entry.id)).toEqual([
      'backlog',
      'in-progress',
      'done',
    ]);
    expect(snapshot.canInitialize).toBe(false);
  });

  it('is idempotent and never removes tasks', async () => {
    const { service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Keep me' }));
    const before = await service.loadBoard();
    const after = await service.initializeBoard();
    expect(after.board?.revision).toBe(before.board?.revision);
    expect(after.tasks.find((entry) => entry.id === task.id)?.title).toBe('Keep me');
    expect(after.columns).toHaveLength(3);
  });

  it('refuses a non-empty .ikanban without board.yaml', async () => {
    const workspace = await createTestWorkspace();
    workspaces.push(workspace);
    await workspace.board.ensureRoot();
    await workspace.fs.writeFile(
      workspace.fs.joinPath(workspace.ikanbanUri, 'stray.yaml'),
      new TextEncoder().encode('x: 1\n'),
    );
    const service = new BoardService({
      board: workspace.board,
      tasks: workspace.tasks,
      clock: new FixedClock(),
      ids: new SequenceIdGenerator(),
      workspaceName: 'Broken',
    });
    await expect(service.initializeBoard()).rejects.toBeInstanceOf(StorageError);
    const loaded = await service.loadBoard();
    expect(loaded.canInitialize).toBe(false);
    expect(loaded.issues.length).toBeGreaterThan(0);
  });
});

describe('LoadBoard', () => {
  it('keeps valid tasks when another task is invalid', async () => {
    const { workspace, service } = await setup();
    const valid = await service.createTask(taskInput({ title: 'Valid' }));
    await workspace.fs.writeFile(
      workspace.fs.joinPath(workspace.ikanbanUri, 'backlog', 'bad.yaml'),
      new TextEncoder().encode('title: [unclosed\n'),
    );
    const snapshot = await service.loadBoard();
    expect(snapshot.tasks.find((entry) => entry.id === valid.id)).toBeDefined();
    expect(snapshot.issues.some((issue) => issue.uri.includes('bad.yaml'))).toBe(true);
  });

  it('reports a missing referenced column while keeping other columns', async () => {
    const { workspace, service } = await setup();
    await writeBoard(
      workspace,
      'version: 1\nname: Test\ncolumns: [backlog, missing, done]\n',
    );
    const snapshot = await service.loadBoard();
    expect(snapshot.board).not.toBeNull();
    expect(column(snapshot, 'backlog')).toBeDefined();
    expect(snapshot.issues.some((issue) => issue.code === 'board/missing-column')).toBe(true);
  });

  it('returns an invalid board without inventing one', async () => {
    const { workspace, service } = await setup();
    await writeBoard(workspace, 'version: 1\ncolumns: [backlog]\n');
    const snapshot = await service.loadBoard();
    expect(snapshot.board).toBeNull();
    expect(snapshot.canInitialize).toBe(false);
    expect(snapshot.issues.length).toBeGreaterThan(0);
  });

  it('warns about unreferenced column directories', async () => {
    const { workspace, service } = await setup();
    await workspace.board.createColumn({
      id: 'orphan',
      title: 'Orphan',
      color: '#000000',
    });
    const snapshot = await service.loadBoard();
    expect(
      snapshot.issues.some((issue) => issue.code === 'board/unreferenced-directory'),
    ).toBe(true);
  });

  it('reports duplicate task IDs across files', async () => {
    const { workspace, service } = await setup();
    const task = await service.createTask(taskInput({ title: 'One' }));
    const raw = await workspace.store.read(
      workspace.fs.joinPath(workspace.ikanbanUri, 'backlog', `${task.id}.yaml`),
    );
    await workspace.fs.writeFile(
      workspace.fs.joinPath(workspace.ikanbanUri, 'in-progress', `${task.id}.yaml`),
      new TextEncoder().encode(raw?.raw ?? ''),
    );
    const snapshot = await service.loadBoard();
    expect(snapshot.issues.some((issue) => issue.code === 'task/duplicate-id')).toBe(true);
    expect(snapshot.tasks.some((entry) => entry.id === task.id)).toBe(false);
  });
});

describe('column use cases', () => {
  it('creates, updates, reorders and deletes a column', async () => {
    const { service } = await setup();
    let snapshot = await service.loadBoard();
    snapshot = await service.createColumn({
      title: 'Review',
      color: '#8b5cf6',
      expectedBoardRevision: snapshot.board!.revision,
    });
    const review = column(snapshot, 'review')!;
    expect(review.title).toBe('Review');

    snapshot = await service.updateColumn({
      id: 'review',
      title: 'Verification',
      color: '#111111',
      expectedRevision: review.revision,
    });
    expect(column(snapshot, 'review')?.title).toBe('Verification');

    snapshot = await service.reorderColumns({
      columnIds: ['review', 'done', 'backlog', 'in-progress'],
      expectedBoardRevision: snapshot.board!.revision,
    });
    expect(snapshot.columns.map((entry) => entry.id)).toEqual([
      'review',
      'done',
      'backlog',
      'in-progress',
    ]);

    snapshot = await service.deleteColumn({
      id: 'review',
      expectedBoardRevision: snapshot.board!.revision,
    });
    expect(column(snapshot, 'review')).toBeUndefined();
  });

  it('rejects duplicate, invalid and populated column changes', async () => {
    const { service } = await setup();
    let snapshot = await service.loadBoard();
    await expect(
      service.createColumn({
        title: 'Backlog',
        color: '#000000',
        expectedBoardRevision: snapshot.board!.revision,
      }),
    ).rejects.toBeInstanceOf(DuplicateEntityError);

    await expect(
      service.createColumn({
        title: 'Bad',
        color: 'red',
        expectedBoardRevision: snapshot.board!.revision,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await service.createTask(taskInput());
    snapshot = await service.loadBoard();
    await expect(
      service.deleteColumn({
        id: 'backlog',
        expectedBoardRevision: snapshot.board!.revision,
      }),
    ).rejects.toThrow('This column cannot be deleted while it contains tasks.');
  });

  it('rejects deleting the final column', async () => {
    const { service } = await setup();
    let snapshot = await service.loadBoard();
    for (const id of ['backlog', 'in-progress']) {
      snapshot = await service.deleteColumn({
        id,
        expectedBoardRevision: snapshot.board!.revision,
      });
    }
    await expect(
      service.deleteColumn({
        id: 'done',
        expectedBoardRevision: snapshot.board!.revision,
      }),
    ).rejects.toThrow('A board must keep at least one column.');
  });
});

describe('task use cases', () => {
  it('creates and persists a task with canonical tags and checklists', async () => {
    const { service } = await setup();
    const task = await service.createTask(
      taskInput({
        title: '  Implement authentication ',
        description: 'Details\nMore details',
        priority: 'high',
        tags: ['spec', 'feat'],
        checklists: [
          {
            title: 'Implementation',
            items: [{ text: 'Create login screen' }, { text: 'Integrate provider' }],
          },
        ],
      }),
    );
    expect(task.title).toBe('Implement authentication');
    expect(task.tags).toEqual(['feat', 'spec']);
    expect(task.checklists).toHaveLength(1);

    const snapshot = await service.loadBoard();
    const loaded = snapshot.tasks.find((entry) => entry.id === task.id)!;
    expect(loaded.description).toBe('Details\nMore details');
    expect(loaded.priority).toBe('high');
    expect(loaded.checklists[0]?.items).toHaveLength(2);
  });

  it('creates, updates and clears an optional deadline', async () => {
    const { service, workspace } = await setup();
    const task = await service.createTask(
      taskInput({ title: 'Deadline', dueAt: '2026-11-25T14:30:00.000Z' }),
    );
    expect(task.dueAt).toBe('2026-11-25T14:30:00.000Z');
    const taskUri = workspace.fs.joinPath(
      workspace.ikanbanUri,
      'backlog',
      `${task.id}.yaml`,
    );
    const raw = await workspace.fs.readFile(taskUri);
    expect(new TextDecoder().decode(raw)).toContain('dueAt: 2026-11-25T14:30:00.000Z');

    const updated = await service.updateTask({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      title: task.title,
      priority: task.priority,
      tags: [],
      dueAt: '2026-12-01T09:00:00.000Z',
    });
    expect(updated.dueAt).toBe('2026-12-01T09:00:00.000Z');

    const cleared = await service.updateTask({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: updated.revision,
      title: task.title,
      priority: task.priority,
      tags: [],
      dueAt: null,
    });
    expect(cleared.dueAt).toBeUndefined();
    const clearedRaw = new TextDecoder().decode(
      await workspace.fs.readFile(taskUri),
    );
    expect(clearedRaw).not.toContain('dueAt:');
  });

  it('rejects an invalid deadline', async () => {
    const { service } = await setup();
    await expect(
      service.createTask(taskInput({ title: 'Invalid', dueAt: '2026-11-25' })),
    ).rejects.toThrow(/ISO 8601/);
  });

  it('updates and deletes a task', async () => {
    const { service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Old' }));
    const updated = await service.updateTask({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      title: 'New',
      description: 'New description',
      priority: 'low',
      tags: ['chore'],
    });
    expect(updated.title).toBe('New');
    expect(updated.priority).toBe('low');

    await service.deleteTask({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: updated.revision,
    });
    const snapshot = await service.loadBoard();
    expect(snapshot.tasks).toHaveLength(0);
  });

  it('maintains createdAt and updatedAt across every mutation path', async () => {
    const { service, clock } = await setup();
    const task = await service.createTask(taskInput({ title: 'Timestamped' }));
    expect(task.createdAt).toBe('2026-11-18T10:00:00.000Z');
    expect(task.updatedAt).toBe(task.createdAt);

    clock.advance(1000);
    const updated = await service.updateTask({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      title: 'Timestamped v2',
      description: '',
      priority: 'medium',
      tags: [],
    });
    expect(updated.createdAt).toBe(task.createdAt);
    expect(updated.updatedAt).toBe('2026-11-18T10:00:01.000Z');

    clock.advance(1000);
    let snapshot = await service.moveTask({
      taskId: task.id,
      fromColumnId: 'backlog',
      toColumnId: 'in-progress',
      targetIndex: 0,
      expectedRevision: updated.revision,
    });
    const moved = snapshot.tasks.find((entry) => entry.id === task.id)!;
    expect(moved.createdAt).toBe(task.createdAt);
    expect(moved.updatedAt).toBe('2026-11-18T10:00:02.000Z');

    clock.advance(1000);
    snapshot = await service.moveTask({
      taskId: task.id,
      fromColumnId: 'in-progress',
      toColumnId: 'in-progress',
      targetIndex: 0,
      expectedRevision: moved.revision,
    });
    const reordered = snapshot.tasks.find((entry) => entry.id === task.id)!;
    expect(reordered.createdAt).toBe(task.createdAt);
    expect(reordered.updatedAt).toBe('2026-11-18T10:00:03.000Z');

    clock.advance(1000);
    const checklist = await service.createChecklist({
      taskId: task.id,
      columnId: 'in-progress',
      expectedRevision: reordered.revision,
      title: 'Checks',
    });
    expect(checklist.createdAt).toBe(task.createdAt);
    expect(checklist.updatedAt).toBe('2026-11-18T10:00:04.000Z');
    const checklistId = checklist.checklists[0]?.id;
    expect(checklistId).toBeDefined();

    clock.advance(1000);
    const item = await service.createChecklistItem({
      taskId: task.id,
      columnId: 'in-progress',
      expectedRevision: checklist.revision,
      checklistId: checklistId!,
      text: 'One',
    });
    expect(item.createdAt).toBe(task.createdAt);
    expect(item.updatedAt).toBe('2026-11-18T10:00:05.000Z');
    const itemId = item.checklists[0]?.items[0]?.id;
    expect(itemId).toBeDefined();

    clock.advance(1000);
    const toggled = await service.toggleChecklistItem({
      taskId: task.id,
      columnId: 'in-progress',
      expectedRevision: item.revision,
      checklistId: checklistId!,
      itemId: itemId!,
    });
    expect(toggled.createdAt).toBe(task.createdAt);
    expect(toggled.updatedAt).toBe('2026-11-18T10:00:06.000Z');
  });

  it('rejects invalid task data and unknown columns', async () => {
    const { service } = await setup();
    await expect(service.createTask(taskInput({ title: '   ' }))).rejects.toThrow(
      'Task title is required.',
    );
    await expect(service.createTask(taskInput({ priority: 'urgent' }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.createTask(taskInput({ columnId: 'missing' }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      service.updateTask({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        columnId: 'backlog',
        expectedRevision: 'missing',
        title: 'Gone',
        priority: 'low',
        tags: [],
      }),
    ).rejects.toThrow('Task not found');
  });

  it('detects stale revisions and preserves external edits', async () => {
    const { workspace, service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Mine' }));
    const uri = workspace.fs.joinPath(workspace.ikanbanUri, 'backlog', `${task.id}.yaml`);
    const raw = await workspace.store.read(uri);
    await workspace.fs.writeFile(
      uri,
      new TextEncoder().encode((raw?.raw ?? '').replace('title: Mine', 'title: External')),
    );

    await expect(
      service.updateTask({
        taskId: task.id,
        columnId: 'backlog',
        expectedRevision: task.revision,
        title: 'Ours',
        priority: 'low',
        tags: [],
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const snapshot = await service.loadBoard();
    expect(snapshot.tasks[0]?.title).toBe('External');
  });

  it('moves a task between columns and preserves checklists', async () => {
    const { service } = await setup();
    const task = await service.createTask(
      taskInput({
        title: 'Move me',
        tags: ['issue'],
        dueAt: '2026-11-25T14:30:00.000Z',
        checklists: [
          {
            title: 'Checklist',
            items: [{ text: 'Done', completed: true }, { text: 'Todo' }],
          },
        ],
      }),
    );
    const snapshot = await service.moveTask({
      taskId: task.id,
      fromColumnId: 'backlog',
      toColumnId: 'in-progress',
      targetIndex: 0,
      expectedRevision: task.revision,
    });
    const moved = snapshot.tasks.find((entry) => entry.id === task.id)!;
    expect(moved.columnId).toBe('in-progress');
    expect(moved.tags).toEqual(['issue']);
    expect(moved.dueAt).toBe('2026-11-25T14:30:00.000Z');
    expect(moved.checklists[0]?.items[0]?.completed).toBe(true);
    expect(column(snapshot, 'backlog')?.taskCount).toBe(0);
    expect(column(snapshot, 'in-progress')?.taskCount).toBe(1);
  });

  it('reorders tasks within a column', async () => {
    const { service } = await setup();
    const first = await service.createTask(taskInput({ title: 'First' }));
    await service.createTask(taskInput({ title: 'Second' }));
    const third = await service.createTask(taskInput({ title: 'Third' }));

    const snapshot = await service.moveTask({
      taskId: third.id,
      fromColumnId: 'backlog',
      toColumnId: 'backlog',
      targetIndex: 0,
      expectedRevision: third.revision,
    });
    expect(
      snapshot.tasks
        .filter((entry) => entry.columnId === 'backlog')
        .map((entry) => entry.title),
    ).toEqual(['Third', 'First', 'Second']);
    expect(
      snapshot.tasks.find((entry) => entry.id === first.id)?.position,
    ).toBeGreaterThan(
      snapshot.tasks.find((entry) => entry.id === third.id)?.position ?? 0,
    );
  });

  it('moves a task when its column changes during an update', async () => {
    const { service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Change column' }));
    const updated = await service.updateTask({
      taskId: task.id,
      columnId: 'done',
      expectedRevision: task.revision,
      title: 'Change column',
      priority: 'medium',
      tags: [],
    });
    expect(updated.columnId).toBe('done');
    const snapshot = await service.loadBoard();
    expect(snapshot.tasks.find((entry) => entry.id === task.id)?.columnId).toBe('done');
  });
});

describe('ordering recovery', () => {
  it('rebalances tight positions in the target column only', async () => {
    const { workspace, service } = await setup();
    const first = await service.createTask(taskInput({ title: 'First' }));
    const second = await service.createTask(taskInput({ title: 'Second' }));
    const third = await service.createTask(taskInput({ title: 'Third' }));

    await workspace.tasks.updateTask({ ...first, position: 1 }, first.revision);
    await workspace.tasks.updateTask({ ...second, position: 2 }, second.revision);
    const before = await service.loadBoard();
    const freshThird = before.tasks.find((task) => task.id === third.id)!;

    const snapshot = await service.moveTask({
      taskId: third.id,
      fromColumnId: 'backlog',
      toColumnId: 'backlog',
      targetIndex: 1,
      expectedRevision: freshThird.revision,
    });
    expect(
      snapshot.tasks
        .filter((task) => task.columnId === 'backlog')
        .map((task) => task.title),
    ).toEqual(['First', 'Third', 'Second']);
    const inProgress = snapshot.tasks.filter((task) => task.columnId !== 'backlog');
    expect(inProgress).toHaveLength(0);
  });

  it('removes the target copy when source deletion fails during a move', async () => {
    const { workspace, service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Rollback' }));
    const faultyFs = new FaultyFileSystem(workspace.fs, {
      deleteFile: (uri) =>
        uri.path.includes('/backlog/') && uri.path.endsWith(`${task.id}.yaml`),
    });
    const faultyStore = new YamlFileStore(faultyFs);
    const faultyBoard = new YamlBoardRepository(faultyFs, faultyStore, workspace.ikanbanUri);
    const faultyTasks = new YamlTaskRepository(faultyFs, faultyStore, faultyBoard);
    const faultyService = new BoardService({
      board: faultyBoard,
      tasks: faultyTasks,
      clock: new FixedClock(),
      ids: new SequenceIdGenerator(),
      workspaceName: 'Test Workspace',
    });

    await expect(
      faultyService.moveTask({
        taskId: task.id,
        fromColumnId: 'backlog',
        toColumnId: 'in-progress',
        targetIndex: 0,
        expectedRevision: task.revision,
      }),
    ).rejects.toBeInstanceOf(StorageError);

    expect(await workspace.tasks.readTaskById('backlog', task.id)).toBeDefined();
    expect(await workspace.tasks.readTaskById('in-progress', task.id)).toBeUndefined();
  });
});

describe('checklist use cases', () => {
  it('supports checklist and item CRUD with derived progress', async () => {
    const { service } = await setup();
    let task = await service.createTask(taskInput({ title: 'Checklist task' }));
    task = await service.createChecklist({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      title: 'Implementation',
    });
    const checklist = task.checklists[0]!;
    expect(checklist.items).toHaveLength(0);

    task = await service.createChecklistItem({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
      text: 'First item',
    });
    let item = task.checklists[0]!.items[0]!;
    task = await service.toggleChecklistItem({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
      itemId: item.id,
    });
    item = task.checklists[0]!.items[0]!;
    expect(item.completed).toBe(true);
    expect(getChecklistProgress(task.checklists[0]!)).toEqual({ completed: 1, total: 1 });

    task = await service.updateChecklistItem({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
      itemId: item.id,
      text: 'Renamed item',
      completed: false,
    });
    expect(task.checklists[0]?.items[0]?.text).toBe('Renamed item');
    expect(task.checklists[0]?.items[0]?.completed).toBe(false);

    task = await service.updateChecklist({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
      title: 'Verification',
    });
    expect(task.checklists[0]?.title).toBe('Verification');

    task = await service.deleteChecklistItem({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
      itemId: item.id,
    });
    expect(task.checklists[0]?.items).toHaveLength(0);

    task = await service.deleteChecklist({
      taskId: task.id,
      columnId: 'backlog',
      expectedRevision: task.revision,
      checklistId: checklist.id,
    });
    expect(task.checklists).toHaveLength(0);
  });

  it('rejects nonexistent checklist entities', async () => {
    const { service } = await setup();
    const task = await service.createTask(taskInput());
    await expect(
      service.updateChecklist({
        taskId: task.id,
        columnId: 'backlog',
        expectedRevision: task.revision,
        checklistId: '650e8400-e29b-41d4-a716-446655440001',
        title: 'Missing',
      }),
    ).rejects.toThrow('Checklist not found');
  });
});

describe('MutationQueue', () => {
  it('serializes rapid task creation', async () => {
    const { service } = await setup();
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.createTask(taskInput({ title: `Task ${index}` })),
      ),
    );
    expect(new Set(created.map((task) => task.id)).size).toBe(8);
    const snapshot = await service.loadBoard();
    expect(snapshot.tasks).toHaveLength(8);
    const positions = snapshot.tasks.map((task) => task.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('deadline after move', () => {
  it('updates a task immediately after a move using the reloaded revision', async () => {
    const { service } = await setup();
    const task = await service.createTask(
      taskInput({ title: 'Moved deadline', dueAt: '2026-11-25T14:30:00.000Z' }),
    );
    let snapshot = await service.moveTask({
      taskId: task.id,
      fromColumnId: 'backlog',
      toColumnId: 'done',
      targetIndex: 0,
      expectedRevision: task.revision,
    });
    snapshot = await service.loadBoard();
    const reloaded = snapshot.tasks.find((entry) => entry.id === task.id)!;
    const cleared = await service.updateTask({
      taskId: reloaded.id,
      columnId: 'done',
      expectedRevision: reloaded.revision,
      title: reloaded.title,
      priority: reloaded.priority,
      tags: reloaded.tags,
      dueAt: null,
    });
    expect(cleared.dueAt).toBeUndefined();
  });
});

describe('concurrency safety', () => {
  it('lets only one of two simultaneous task updates win', async () => {
    const { service } = await setup();
    const task = await service.createTask(taskInput({ title: 'Original' }));
    const update = (title: string) =>
      service.updateTask({
        taskId: task.id,
        columnId: 'backlog',
        expectedRevision: task.revision,
        title,
        priority: 'medium',
        tags: [],
      });

    const results = await Promise.allSettled([update('Winner A'), update('Winner B')]);
    const fulfilled = results.filter((entry) => entry.status === 'fulfilled');
    const rejected = results.filter((entry) => entry.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'ConflictError',
    });

    const snapshot = await service.loadBoard();
    const persisted = snapshot.tasks.find((entry) => entry.id === task.id)!;
    expect(['Winner A', 'Winner B']).toContain(persisted.title);
  });

  it('lets only one of two simultaneous checklist changes win', async () => {
    const { service } = await setup();
    const created = await service.createTask(
      taskInput({
        title: 'Checklist race',
        checklists: [{ title: 'Steps', items: [{ text: 'One' }] }],
      }),
    );
    const checklistId = created.checklists[0]!.id;
    const itemId = created.checklists[0]!.items[0]!.id;

    const results = await Promise.allSettled([
      service.updateChecklist({
        taskId: created.id,
        columnId: 'backlog',
        expectedRevision: created.revision,
        checklistId,
        title: 'Renamed',
      }),
      service.toggleChecklistItem({
        taskId: created.id,
        columnId: 'backlog',
        expectedRevision: created.revision,
        checklistId,
        itemId,
      }),
    ]);
    expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((entry) => entry.status === 'rejected')).toHaveLength(1);

    const snapshot = await service.loadBoard();
    const persisted = snapshot.tasks.find((entry) => entry.id === created.id)!;
    expect(persisted.checklists).toHaveLength(1);
    expect(persisted.checklists[0]!.items).toHaveLength(1);
  });

  it('rejects a board mutation after an external board.yaml change', async () => {
    const { service, workspace } = await setup();
    const before = await service.loadBoard();
    const oldRevision = before.board!.revision;
    const external = [
      'version: 1',
      'name: External board',
      'columns:',
      '  - backlog',
      '  - in-progress',
      '  - done',
      '',
    ].join('\n');
    await writeBoard(workspace, external);

    await expect(
      service.reorderColumns({
        columnIds: ['done', 'in-progress', 'backlog'],
        expectedBoardRevision: oldRevision,
      }),
    ).rejects.toMatchObject({ code: 'ConflictError' });

    const persisted = new TextDecoder().decode(
      await workspace.fs.readFile(workspace.board.boardUri),
    );
    expect(persisted).toContain('name: External board');
  });

  it('lets only one of two simultaneous board revisions win', async () => {
    const { service } = await setup();
    const snapshot = await service.loadBoard();
    const revision = snapshot.board!.revision;
    const results = await Promise.allSettled([
      service.reorderColumns({
        columnIds: ['done', 'in-progress', 'backlog'],
        expectedBoardRevision: revision,
      }),
      service.reorderColumns({
        columnIds: ['in-progress', 'backlog', 'done'],
        expectedBoardRevision: revision,
      }),
    ]);
    expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((entry) => entry.status === 'rejected')).toHaveLength(1);

    const after = await service.loadBoard();
    expect(after.board!.columnIds).toHaveLength(3);
  });
});
