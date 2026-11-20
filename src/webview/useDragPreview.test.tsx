import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { TaskView } from '../shared/board';
import { useDragPreview } from './useDragPreview';

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 'a',
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

const columns = [{ id: 'backlog' }, { id: 'done' }];
const tasks = [
  task({ id: 'a', position: 1024 }),
  task({ id: 'b', position: 2048 }),
  task({ id: 'c', position: 1024, columnId: 'done' }),
];

function start(id = 'a'): DragStartEvent {
  return { active: { id } } as unknown as DragStartEvent;
}

function over(id: string, activeTop = 0, overTop = 0, overHeight = 100): DragOverEvent {
  return {
    active: { id: 'a', rect: { current: { translated: { top: activeTop } } } },
    over: { id, rect: { top: overTop, height: overHeight } },
  } as unknown as DragOverEvent;
}

function end(id = 'a', overId = 'column:done'): DragEndEvent {
  return { active: { id }, over: { id: overId } } as unknown as DragEndEvent;
}

function endWithoutTarget(id = 'a'): DragEndEvent {
  return { active: { id }, over: null } as unknown as DragEndEvent;
}

function setup(
  moveTask: (task: TaskView, toColumnId: string, targetIndex: number) => Promise<void> = vi.fn(
    async () => undefined,
  ),
) {
  return {
    moveTask,
    ...renderHook(() => useDragPreview({ columns, tasks, moveTask })),
  };
}

describe('useDragPreview', () => {
  it('builds the preview order and exposes the dragged task', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));

    expect(hook.result.current.dragPreview?.order).toEqual({
      backlog: ['a', 'b'],
      done: ['c'],
    });
    expect(hook.result.current.draggedTask?.id).toBe('a');
    expect(hook.result.current.tasksFor('backlog').map((entry) => entry.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('previews a cross-column move while dragging', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));

    expect(hook.result.current.dragPreview?.order).toEqual({
      backlog: ['b'],
      done: ['c', 'a'],
    });
    expect(hook.result.current.tasksFor('done').map((entry) => entry.id)).toEqual([
      'c',
      'a',
    ]);
  });

  it('previews insertion before a task using the pointer direction', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('c', 0, 0, 100)));

    expect(hook.result.current.dragPreview?.order.done).toEqual(['a', 'c']);
  });

  it('ignores unknown targets and no-op positions', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    const initial = hook.result.current.dragPreview;

    act(() => hook.result.current.handleDragOver(over('unknown')));
    expect(hook.result.current.dragPreview).toBe(initial);

    act(() => hook.result.current.handleDragOver(over('b')));
    expect(hook.result.current.dragPreview).toBe(initial);
  });

  it('sends one move request on drop using the previewed target', async () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));
    act(() => hook.result.current.handleDragEnd(end()));

    expect(hook.moveTask).toHaveBeenCalledOnce();
    expect(hook.moveTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
      'done',
      1,
    );
  });

  it('keeps the preview until persistence finishes', async () => {
    let release: (() => void) | undefined;
    const moveTask = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const hook = setup(moveTask);
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));
    act(() => hook.result.current.handleDragEnd(end()));

    expect(hook.result.current.dragPreview).not.toBeNull();

    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    expect(hook.result.current.dragPreview).toBeNull();
  });

  it('clears the preview without a request when the drop does not change position', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragEnd(end('a', 'a')));

    expect(hook.moveTask).not.toHaveBeenCalled();
    expect(hook.result.current.dragPreview).toBeNull();
  });

  it('cancels without a request when the drop has no target', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));
    act(() => hook.result.current.handleDragEnd(endWithoutTarget()));

    expect(hook.moveTask).not.toHaveBeenCalled();
    expect(hook.result.current.dragPreview).toBeNull();
  });

  it('clears the preview when the drag is cancelled', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragCancel());

    expect(hook.result.current.dragPreview).toBeNull();
    expect(hook.moveTask).not.toHaveBeenCalled();
  });

  it('clears the preview when persistence fails', async () => {
    const hook = setup(
      vi.fn(async () => {
        throw new Error('Move failed.');
      }),
    );
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));
    act(() => hook.result.current.handleDragEnd(end()));
    expect(hook.moveTask).toHaveBeenCalledOnce();

    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.dragPreview).toBeNull();
  });

  it('ignores drag starts for unknown tasks', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start('missing')));
    expect(hook.result.current.dragPreview).toBeNull();
  });
});

describe('useDragPreview with partial columns', () => {
  it('appends at the full column count when dropped at the end', async () => {
    const moveTask = vi.fn(async () => undefined);
    const hook = renderHook(() =>
      useDragPreview({
        columns,
        tasks,
        columnTaskCounts: { backlog: 2, done: 100 },
        moveTask,
      }),
    );
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:done')));
    act(() => hook.result.current.handleDragEnd(end()));

    expect(moveTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'done', 100);
  });
});
