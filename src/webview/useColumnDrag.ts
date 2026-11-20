import { useCallback, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { ColumnView, TaskView } from '../shared/board';
import {
  columnOrdersEqual,
  moveColumnInPreview,
  resolveColumnTargetId,
} from './state/columnState';

interface ColumnDragOptions {
  columns: readonly ColumnView[];
  tasks: readonly TaskView[];
  reorderColumns(columnIds: string[]): Promise<void>;
}

export function useColumnDrag({ columns, tasks, reorderColumns }: ColumnDragOptions) {
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (event.active.data.current?.kind !== 'column') {
        return;
      }
      const columnId = event.active.data.current.columnId as string | undefined;
      if (!columnId || !columns.some((column) => column.id === columnId)) {
        return;
      }
      setActiveColumnId(columnId);
      setPreviewIds(columns.map((column) => column.id));
    },
    [columns],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (event.active.data.current?.kind !== 'column' || !event.over) {
        return;
      }
      const activeId = event.active.data.current.columnId as string | undefined;
      const targetId = resolveColumnTargetId(String(event.over.id), tasks);
      if (!activeId || !targetId) {
        return;
      }
      setPreviewIds((current) => {
        if (!current) {
          return current;
        }
        return moveColumnInPreview(current, activeId, targetId) ?? current;
      });
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.active.data.current?.kind !== 'column') {
        return;
      }
      const preview = previewIds;
      setActiveColumnId(null);
      if (!preview) {
        setPreviewIds(null);
        return;
      }
      const original = columns.map((column) => column.id);
      if (columnOrdersEqual(original, preview)) {
        setPreviewIds(null);
        return;
      }
      void reorderColumns(preview).finally(() => setPreviewIds(null));
    },
    [columns, previewIds, reorderColumns],
  );

  const handleDragCancel = useCallback(() => {
    setActiveColumnId(null);
    setPreviewIds(null);
  }, []);

  const previewColumns = previewIds
    ? previewIds
        .map((id) => columns.find((column) => column.id === id))
        .filter((column): column is ColumnView => column !== undefined)
    : columns;

  return {
    previewColumns,
    draggedColumn: columns.find((column) => column.id === activeColumnId),
    isColumnDragging: previewIds !== null,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
