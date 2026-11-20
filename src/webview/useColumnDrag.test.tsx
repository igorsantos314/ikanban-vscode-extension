import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { ColumnView, TaskView } from '../shared/board';
import { useColumnDrag } from './useColumnDrag';

const columns: ColumnView[] = [
  { id: 'backlog', title: 'Backlog', color: '#64748b', revision: 'a', taskCount: 1 },
  { id: 'done', title: 'Done', color: '#22c55e', revision: 'b', taskCount: 0 },
  { id: 'review', title: 'Review', color: '#8b5cf6', revision: 'c', taskCount: 0 },
];

const tasks = [
  { id: 'task-1', columnId: 'backlog' } as TaskView,
  { id: 'task-2', columnId: 'review' } as TaskView,
];

function start(columnId = 'backlog'): DragStartEvent {
  return {
    active: { id: `column-drag:${columnId}`, data: { current: { kind: 'column', columnId } } },
  } as unknown as DragStartEvent;
}

function over(overId: string, columnId = 'backlog'): DragOverEvent {
  return {
    active: {
      id: `column-drag:${columnId}`,
      data: { current: { kind: 'column', columnId } },
    },
    over: { id: overId },
  } as unknown as DragOverEvent;
}

function end(columnId = 'backlog'): DragEndEvent {
  return {
    active: { id: `column-drag:${columnId}`, data: { current: { kind: 'column', columnId } } },
    over: { id: 'column:done' },
  } as unknown as DragEndEvent;
}

function setup(reorderColumns = vi.fn(async () => undefined)) {
  return {
    reorderColumns,
    ...renderHook(() => useColumnDrag({ columns, tasks, reorderColumns })),
  };
}

describe('useColumnDrag', () => {
  it('builds a preview order from a column drag', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    expect(hook.result.current.previewColumns.map((column) => column.id)).toEqual([
      'backlog',
      'done',
      'review',
    ]);
    expect(hook.result.current.draggedColumn?.id).toBe('backlog');

    act(() => hook.result.current.handleDragOver(over('column:review')));
    expect(hook.result.current.previewColumns.map((column) => column.id)).toEqual([
      'done',
      'review',
      'backlog',
    ]);
  });

  it('resolves a task target to its column', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('task-2')));
    expect(hook.result.current.previewColumns.map((column) => column.id)).toEqual([
      'done',
      'review',
      'backlog',
    ]);
  });

  it('sends one reorder request on drop', async () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragOver(over('column:review')));
    act(() => hook.result.current.handleDragEnd(end()));

    expect(hook.reorderColumns).toHaveBeenCalledOnce();
    expect(hook.reorderColumns).toHaveBeenCalledWith(['done', 'review', 'backlog']);
  });

  it('does not request when the order did not change', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragEnd(end()));
    expect(hook.reorderColumns).not.toHaveBeenCalled();
    expect(hook.result.current.previewColumns.map((column) => column.id)).toEqual([
      'backlog',
      'done',
      'review',
    ]);
  });

  it('clears the preview on cancel', () => {
    const hook = setup();
    act(() => hook.result.current.handleDragStart(start()));
    act(() => hook.result.current.handleDragCancel());
    expect(hook.result.current.draggedColumn).toBeUndefined();
    expect(hook.result.current.isColumnDragging).toBe(false);
  });

  it('ignores task drag data', () => {
    const hook = setup();
    act(() =>
      hook.result.current.handleDragStart({
        active: { id: 'task-1', data: { current: { kind: 'task' } } },
      } as unknown as DragStartEvent),
    );
    expect(hook.result.current.isColumnDragging).toBe(false);
  });
});
