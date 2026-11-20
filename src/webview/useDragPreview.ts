import { useCallback, useMemo, useState } from 'react';
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

export function useDragPreview({
  columns,
  tasks,
  columnTaskCounts = {},
  moveTask,
}: UseDragPreviewOptions) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

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
      setDragPreview({ activeId, order: buildPreviewOrder(columns, tasks) });
    },
    [columns, tasks],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!event.over) {
      return;
    }
    setDragPreview((current) => {
      if (!current) {
        return current;
      }
      const activeRect = event.active.rect.current.translated;
      const overRect = event.over?.rect;
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
        String(event.over?.id),
        pointer,
      );
      if (!next || previewOrdersEqual(next, current.order)) {
        return current;
      }
      return { ...current, order: next };
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const preview = dragPreview;
      if (!preview) {
        return;
      }
      if (!event.over) {
        setDragPreview(null);
        return;
      }
      const activeId = String(event.active.id);
      const task = tasks.find((entry) => entry.id === activeId);
      if (!task || previewOrdersEqual(buildPreviewOrder(columns, tasks), preview.order)) {
        setDragPreview(null);
        return;
      }
      const target = moveTargetFromPreview(preview.order, activeId);
      if (!target) {
        setDragPreview(null);
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
        .finally(() => setDragPreview(null));
    },
    [columnTaskCounts, columns, dragPreview, moveTask, tasks],
  );

  const handleDragCancel = useCallback(() => {
    setDragPreview(null);
  }, []);

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
