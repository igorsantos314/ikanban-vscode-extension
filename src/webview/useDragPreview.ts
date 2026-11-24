import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { TaskView } from '../shared/board';
import {
  buildPreviewOrder,
  moveTargetFromPreview,
  moveTaskInPreview,
  previewOrdersEqual,
  tasksForColumn,
  type PreviewOrder,
} from './state/boardState';

export interface DragPreview {
  activeId: string;
  order: PreviewOrder;
}

export interface UseDragPreviewOptions {
  columns: readonly { id: string }[];
  tasks: readonly TaskView[];
  columnTaskCounts?: Record<string, number>;
  moveTask(task: TaskView, toColumnId: string, targetIndex: number): Promise<void>;
}

interface ScheduledFrame {
  cancel(): void;
}

/**
 * Batch render commits to one per animation frame.
 *
 * Reordering the sortable items on every `dragOver` event can make dnd-kit
 * re-measure the droppables, which fires another `dragOver` with a different
 * target, which reorders again. Near a column or card boundary this can loop
 * synchronously until React throws "Maximum update depth exceeded" and unmounts
 * the whole board. Keeping the logical order up to date immediately, but
 * committing it to React at most once per frame, breaks that loop while the
 * latest preview still reaches the screen.
 */
function scheduleFrame(action: () => void): ScheduledFrame {
  const globalWithFrame = globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
  };
  if (typeof globalWithFrame.requestAnimationFrame === 'function') {
    const handle = globalWithFrame.requestAnimationFrame(() => action());
    return {
      cancel: () => globalWithFrame.cancelAnimationFrame?.(handle),
    };
  }
  const handle = setTimeout(action, 0);
  return { cancel: () => clearTimeout(handle) };
}

export function useDragPreview({
  columns,
  tasks,
  columnTaskCounts = {},
  moveTask,
}: UseDragPreviewOptions) {
  const [dragPreview, setDragPreviewState] = useState<DragPreview | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const frameRef = useRef<ScheduledFrame | null>(null);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const cancelScheduledCommit = useCallback(() => {
    frameRef.current?.cancel();
    frameRef.current = null;
  }, []);

  const commitPreview = useCallback((next: DragPreview | null) => {
    dragPreviewRef.current = next;
    setDragPreviewState(next);
  }, []);

  const scheduleCommit = useCallback(() => {
    if (frameRef.current) {
      return;
    }
    frameRef.current = scheduleFrame(() => {
      frameRef.current = null;
      const latest = dragPreviewRef.current;
      if (latest) {
        setDragPreviewState(latest);
      }
    });
  }, []);

  useEffect(() => () => cancelScheduledCommit(), [cancelScheduledCommit]);

  const applyDragOver = useCallback(
    (event: DragOverEvent) => {
      const current = dragPreviewRef.current;
      if (!current || !event.over) {
        return;
      }
      const activeRect = event.active.rect.current.translated;
      const overRect = event.over.rect;
      const pointer =
        activeRect && overRect
          ? {
              activeTop: activeRect.top,
              overTop: overRect.top,
              overHeight: overRect.height,
            }
          : undefined;
      const next = moveTaskInPreview(
        current.order,
        String(event.active.id),
        String(event.over.id),
        pointer,
      );
      if (!next || previewOrdersEqual(next, current.order)) {
        return;
      }
      dragPreviewRef.current = { ...current, order: next };
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const tasksFor = useCallback(
    (columnId: string) => {
      if (!dragPreview) {
        return tasksForColumn(tasks, columnId);
      }
      return (dragPreview.order[columnId] ?? [])
        .map((id) => tasksById.get(id))
        .filter((task): task is TaskView => task !== undefined);
    },
    [dragPreview, tasks, tasksById],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id);
      if (!tasks.some((task) => task.id === activeId)) {
        return;
      }
      cancelScheduledCommit();
      commitPreview({ activeId, order: buildPreviewOrder(columns, tasks) });
    },
    [cancelScheduledCommit, columns, commitPreview, tasks],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      applyDragOver(event);
    },
    [applyDragOver],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // The ref always holds the latest drag-over result, even when its render
      // commit is still waiting for the next frame.
      cancelScheduledCommit();
      const preview = dragPreviewRef.current;
      if (!preview) {
        return;
      }
      if (!event.over) {
        commitPreview(null);
        return;
      }
      const activeId = String(event.active.id);
      const task = tasks.find((entry) => entry.id === activeId);
      if (!task || previewOrdersEqual(buildPreviewOrder(columns, tasks), preview.order)) {
        commitPreview(null);
        return;
      }
      const target = moveTargetFromPreview(preview.order, activeId);
      if (!target) {
        commitPreview(null);
        return;
      }
      const targetOrder = preview.order[target.toColumnId] ?? [];
      const isAtEnd = targetOrder[targetOrder.length - 1] === activeId;
      const fallbackEnd = Math.max(0, targetOrder.length - 1);
      const targetIndex = isAtEnd
        ? columnTaskCounts[target.toColumnId] !== undefined
          ? Math.max(
              0,
              columnTaskCounts[target.toColumnId]! -
                (task.columnId === target.toColumnId ? 1 : 0),
            )
          : fallbackEnd
        : target.targetIndex;
      void moveTask(task, target.toColumnId, targetIndex)
        .catch(() => undefined)
        .finally(() => {
          // A newer drag may have started while this move was persisted.
          if (dragPreviewRef.current === preview) {
            commitPreview(null);
          }
        });
    },
    [
      cancelScheduledCommit,
      columnTaskCounts,
      columns,
      commitPreview,
      moveTask,
      tasks,
    ],
  );

  const handleDragCancel = useCallback(() => {
    cancelScheduledCommit();
    commitPreview(null);
  }, [cancelScheduledCommit, commitPreview]);

  const draggedTask = dragPreview
    ? tasks.find((task) => task.id === dragPreview.activeId)
    : undefined;

  return {
    dragPreview,
    draggedTask,
    tasksFor,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
