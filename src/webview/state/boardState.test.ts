import { describe, expect, it } from 'vitest';
import type { BoardSnapshot, TaskView } from '../../shared/board';
import {
  boardReducer,
  buildPreviewOrder,
  computeMoveTarget,
  initialBoardState,
  locateTaskInPreview,
  moveTargetFromPreview,
  moveTaskInPreview,
  previewOrdersEqual,
  tasksForColumn,
} from './boardState';

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 'task-1',
    title: 'Task',
    description: '',
    columnId: 'backlog',
    tags: [],
    priority: 'medium',
    position: 1024,
    checklists: [],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    revision: 'rev-1',
    ...overrides,
  };
}

function snapshot(tasks: TaskView[] = []): BoardSnapshot {
  return {
    workspaceName: 'Workspace',
    board: { version: 1, name: 'Board', columnIds: ['backlog', 'done'], revision: 'board-rev' },
    columns: [
      {
        id: 'backlog', title: 'Backlog', color: '#64748b', revision: 'a',
        taskCount: tasks.filter((task) => task.columnId === 'backlog').length,
      },
      {
        id: 'done', title: 'Done', color: '#22c55e', revision: 'b',
        taskCount: tasks.filter((task) => task.columnId === 'done').length,
      },
    ],
    tasks,
    issues: [],
    canInitialize: false,
  };
}

describe('boardReducer', () => {
  it('determines ready, empty and error states', () => {
    expect(
      boardReducer(initialBoardState, { type: 'loaded', snapshot: snapshot() }).status,
    ).toBe('ready');
    expect(
      boardReducer(initialBoardState, {
        type: 'loaded',
        snapshot: { ...snapshot(), board: null, columns: [], canInitialize: true },
      }).status,
    ).toBe('empty');
    expect(
      boardReducer(initialBoardState, {
        type: 'loaded',
        snapshot: { ...snapshot(), board: null, columns: [], canInitialize: false },
      }).status,
    ).toBe('error');
  });

  it('patches a single task and recalculates column counts', () => {
    const loaded = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: snapshot([task()]),
    });
    const updated = boardReducer(loaded, {
      type: 'upsert-task',
      task: task({ title: 'Updated' }),
    });
    expect(updated.snapshot?.tasks[0]?.title).toBe('Updated');
    expect(updated.snapshot?.columns[0]?.taskCount).toBe(1);
  });

  it('moves a task between columns when patched', () => {
    const loaded = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: snapshot([task()]),
    });
    const moved = boardReducer(loaded, {
      type: 'upsert-task',
      task: task({ columnId: 'done', position: 1024 }),
    });
    expect(moved.snapshot?.columns[0]?.taskCount).toBe(0);
    expect(moved.snapshot?.columns[1]?.taskCount).toBe(1);
  });

  it('removes a task and updates counts', () => {
    const loaded = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: snapshot([task()]),
    });
    const removed = boardReducer(loaded, { type: 'remove-task', taskId: 'task-1' });
    expect(removed.snapshot?.tasks).toEqual([]);
    expect(removed.snapshot?.columns[0]?.taskCount).toBe(0);
  });

  it('keeps a dialog open when a watcher snapshot arrives', () => {
    const loaded = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: snapshot([task()]),
    });
    const withDialog = boardReducer(loaded, {
      type: 'task-dialog',
      target: { mode: 'edit', task: task() },
    });
    const reloaded = boardReducer(withDialog, {
      type: 'loaded',
      snapshot: snapshot([task({ title: 'External' })]),
    });
    expect(reloaded.taskDialog).not.toBeNull();
    expect(reloaded.snapshot?.tasks[0]?.title).toBe('External');
  });

  it('tracks validation panel state and banners', () => {
    let state = boardReducer(initialBoardState, {
      type: 'banner',
      banner: { kind: 'warning', message: 'Issues found' },
    });
    expect(state.banner?.message).toBe('Issues found');
    state = boardReducer(state, { type: 'validation', open: true });
    expect(state.validationOpen).toBe(true);
    state = boardReducer(state, { type: 'dismiss-banner' });
    expect(state.banner).toBeNull();
  });
});

describe('computeMoveTarget', () => {
  const tasks = [
    task({ id: 'a', position: 1024 }),
    task({ id: 'b', position: 2048 }),
    task({ id: 'c', position: 1024, columnId: 'done' }),
  ];

  it('computes a target when dropping over a task', () => {
    expect(computeMoveTarget(tasks, 'c', 'a')).toEqual({
      toColumnId: 'backlog',
      targetIndex: 0,
    });
  });

  it('computes the end of a column when dropping on the column', () => {
    expect(computeMoveTarget(tasks, 'a', 'column:done')).toEqual({
      toColumnId: 'done',
      targetIndex: 1,
    });
  });

  it('ignores dropping a task on itself or an unknown target', () => {
    expect(computeMoveTarget(tasks, 'a', 'a')).toBeNull();
    expect(computeMoveTarget(tasks, 'a', 'unknown')).toBeNull();
  });

  it('sorts tasks for a column by position', () => {
    expect(tasksForColumn(tasks, 'backlog').map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('drag preview order', () => {
  const tasks = [
    task({ id: 'a', position: 1024 }),
    task({ id: 'b', position: 2048 }),
    task({ id: 'c', position: 3072 }),
    task({ id: 'd', position: 1024, columnId: 'done' }),
  ];
  const order = buildPreviewOrder(snapshot().columns, tasks);

  it('builds one ordered id list per column', () => {
    expect(order).toEqual({ backlog: ['a', 'b', 'c'], done: ['d'] });
  });

  it('moves a task to the end of another column', () => {
    expect(moveTaskInPreview(order, 'a', 'column:done')).toEqual({
      backlog: ['b', 'c'],
      done: ['d', 'a'],
    });
  });

  it('inserts before or after a task using the pointer direction', () => {
    expect(moveTaskInPreview(order, 'a', 'c')).toEqual({
      backlog: ['b', 'a', 'c'],
      done: ['d'],
    });
    expect(
      moveTaskInPreview(order, 'a', 'c', { activeTop: 320, overTop: 300, overHeight: 20 }),
    ).toEqual({
      backlog: ['b', 'c', 'a'],
      done: ['d'],
    });
    expect(moveTaskInPreview(order, 'a', 'b')).toBeNull();
  });

  it('reorders within the same column', () => {
    expect(
      moveTaskInPreview(order, 'c', 'a', { activeTop: 50, overTop: 100, overHeight: 20 }),
    ).toEqual({
      backlog: ['c', 'a', 'b'],
      done: ['d'],
    });
  });

  it('moves into an empty column', () => {
    const empty = { backlog: ['a', 'b'], done: [] };
    expect(moveTaskInPreview(empty, 'a', 'column:done')).toEqual({
      backlog: ['b'],
      done: ['a'],
    });
  });

  it('ignores unknown targets, self drops and no-op positions', () => {
    expect(moveTaskInPreview(order, 'a', 'a')).toBeNull();
    expect(moveTaskInPreview(order, 'a', 'unknown')).toBeNull();
    expect(moveTaskInPreview(order, 'a', 'column:missing')).toBeNull();
    expect(moveTaskInPreview(order, 'a', 'b')).toBeNull();
  });

  it('derives the authoritative move target from the preview', () => {
    const next = moveTaskInPreview(order, 'a', 'column:done');
    expect(next).not.toBeNull();
    expect(moveTargetFromPreview(next!, 'a')).toEqual({
      toColumnId: 'done',
      targetIndex: 1,
    });
  });

  it('compares preview orders', () => {
    const next = moveTaskInPreview(order, 'a', 'column:done');
    expect(next).not.toBeNull();
    expect(previewOrdersEqual(order, order)).toBe(true);
    expect(previewOrdersEqual(order, next!)).toBe(false);
    expect(previewOrdersEqual(order, { backlog: ['a', 'b'], done: ['d'] })).toBe(false);
  });

  it('locates tasks in the preview order', () => {
    expect(locateTaskInPreview(order, 'c')).toEqual({ columnId: 'backlog', index: 2 });
    expect(locateTaskInPreview(order, 'missing')).toBeNull();
  });
});

describe('pagination state', () => {
  function pagedSnapshot(revision: string, tasks: TaskView[], hasMore = true): BoardSnapshot {
    return {
      workspaceName: 'Workspace',
      board: { version: 1, name: 'Board', columnIds: ['backlog'], revision: 'b' },
      columns: [
        {
          id: 'backlog',
          title: 'Backlog',
          color: '#64748b',
          revision: 'col',
          taskCount: hasMore ? tasks.length + 1 : tasks.length,
          loadedCount: tasks.length,
          tasksRevision: revision,
          hasMore,
          nextCursor: hasMore
            ? { position: tasks[tasks.length - 1]!.position, taskId: tasks[tasks.length - 1]!.id }
            : null,
        },
      ],
      tasks,
      issues: [],
      canInitialize: false,
    };
  }

  it('keeps loaded pages when the column revision is unchanged', () => {
    const first = task({ id: 'a', position: 1024 });
    const second = task({ id: 'b', position: 2048 });
    let state = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: pagedSnapshot('rev-1', [first]),
    });
    state = boardReducer(state, {
      type: 'loaded',
      snapshot: pagedSnapshot('rev-1', [first]),
    });
    expect(state.snapshot?.tasks.map((entry) => entry.id)).toEqual(['a']);

    state = boardReducer(state, {
      type: 'page-loaded',
      columnId: 'backlog',
      page: {
        columnId: 'backlog',
        tasks: [second],
        nextCursor: null,
        hasMore: false,
        taskCount: 2,
        tasksRevision: 'rev-1',
      },
    });
    expect(state.snapshot?.tasks.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(state.pages.backlog?.status).toBe('end');
  });

  it('resets a column when its revision changes', () => {
    const first = task({ id: 'a', position: 1024 });
    const replacement = task({ id: 'c', position: 1024 });
    let state = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: pagedSnapshot('rev-1', [first]),
    });
    state = boardReducer(state, {
      type: 'loaded',
      snapshot: pagedSnapshot('rev-2', [replacement]),
    });
    expect(state.snapshot?.tasks.map((entry) => entry.id)).toEqual(['c']);
    expect(state.pages.backlog?.tasksRevision).toBe('rev-2');
  });

  it('does not duplicate repeated page tasks', () => {
    const first = task({ id: 'a', position: 1024 });
    const state = boardReducer(
      boardReducer(initialBoardState, {
        type: 'loaded',
        snapshot: pagedSnapshot('rev-1', [first]),
      }),
      {
        type: 'page-loaded',
        columnId: 'backlog',
        page: {
          columnId: 'backlog',
          tasks: [first],
          nextCursor: null,
          hasMore: false,
          taskCount: 1,
          tasksRevision: 'rev-1',
        },
      },
    );
    expect(state.snapshot?.tasks).toHaveLength(1);
  });

  it('tracks loading and failure states', () => {
    const first = task({ id: 'a', position: 1024 });
    let state = boardReducer(initialBoardState, {
      type: 'loaded',
      snapshot: pagedSnapshot('rev-1', [first]),
    });
    state = boardReducer(state, { type: 'page-loading', columnId: 'backlog' });
    expect(state.pages.backlog?.status).toBe('loading');
    state = boardReducer(state, {
      type: 'page-failed',
      columnId: 'backlog',
      message: 'No connection',
    });
    expect(state.pages.backlog).toMatchObject({ status: 'error', error: 'No connection' });
  });
});
