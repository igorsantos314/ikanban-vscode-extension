import { useEffect, useRef, type CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnView, TaskView } from '../../shared/board';
import type { CardLayout } from '../cardLayout';
import type { ColumnPageState } from '../state/boardState';
import { TaskCard, type KeyboardMoveDirection } from './TaskCard';

export function BoardColumn({
  column,
  tasks,
  cardLayout,
  isDropTarget,
  page,
  onLoadMore,
  onAddTask,
  onEditTask,
  onKeyboardMoveTask,
  onReorderColumn,
  onEditColumn,
  onDeleteColumn,
  dragDisabled,
}: {
  column: ColumnView;
  tasks: readonly TaskView[];
  cardLayout: CardLayout;
  isDropTarget?: boolean;
  page?: ColumnPageState;
  onLoadMore(columnId: string): void;
  onAddTask(column: ColumnView): void;
  onEditTask(task: TaskView): void;
  onKeyboardMoveTask(task: TaskView, direction: KeyboardMoveDirection): void;
  onReorderColumn(column: ColumnView, direction: -1 | 1): void;
  onEditColumn(column: ColumnView): void;
  onDeleteColumn(column: ColumnView): void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !page?.hasMore ||
      page.status === 'loading' ||
      !sentinel ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore(column.id);
        }
      },
      { root: scrollRef.current, rootMargin: '120px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [column.id, onLoadMore, page?.hasMore, page?.status]);
  const {
    listeners,
    setNodeRef: setHeaderRef,
    isDragging: isHeaderDragging,
  } = useDraggable({
    id: `column-drag:${column.id}`,
    data: { kind: 'column', columnId: column.id },
    disabled: dragDisabled,
  });

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver || isDropTarget ? 'board-column-over' : ''}`}
      style={{ '--column-color': column.color } as CSSProperties}
      aria-label={`${column.title} column`}
    >
      <header
        ref={setHeaderRef}
        className={`column-header ${isHeaderDragging ? 'column-header-dragging' : ''}`}
        tabIndex={0}
        aria-label={`${column.title} column header`}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
        title="Drag the header to reorder. Alt+Arrow moves the column."
        onKeyDown={(event) => {
          if (!event.altKey) {
            return;
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onReorderColumn(column, -1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onReorderColumn(column, 1);
          }
        }}
        {...listeners}
      >
        <div className="column-identity">
          <span className="column-dot" aria-hidden="true" />
          <h2 className="column-title">{column.title}</h2>
          <span
            className="column-count"
            aria-label={`${column.taskCount} ${column.taskCount === 1 ? 'task' : 'tasks'}`}
          >
            {column.taskCount}
          </span>
        </div>
        <div
          className="column-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="icon-button"
            aria-label={`Edit ${column.title} column`}
            onClick={() => onEditColumn(column)}
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`Delete ${column.title} column`}
            onClick={() => onDeleteColumn(column)}
          >
            ×
          </button>
        </div>
      </header>

      <div className="column-scroll" ref={scrollRef}>
        <button
          type="button"
          className="column-add"
          onClick={() => onAddTask(column)}
          aria-label={`Add task to ${column.title}`}
        >
          <span aria-hidden="true">+</span> Add task
        </button>

        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              cardLayout={cardLayout}
              onEdit={onEditTask}
              onKeyboardMove={onKeyboardMoveTask}
              dragDisabled={dragDisabled}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && column.taskCount === 0 ? (
          <p className="column-empty">No tasks yet</p>
        ) : null}

        <div ref={sentinelRef} className="column-page-sentinel" aria-hidden="true" />

        {page?.status === 'loading' ? (
          <p className="column-page-state" role="status">
            Loading more tasks…
          </p>
        ) : page?.status === 'error' ? (
          <div className="column-page-state">
            <span role="alert">{page.error ?? 'Could not load more tasks.'}</span>
            <button type="button" className="btn" onClick={() => onLoadMore(column.id)}>
              Retry
            </button>
          </div>
        ) : page?.hasMore ? (
          <button
            type="button"
            className="btn column-load-more"
            onClick={() => onLoadMore(column.id)}
          >
            Load more
          </button>
        ) : (column.loadedCount ?? tasks.length) > 0 && column.taskCount > tasks.length ? (
          <p className="column-page-state">End of loaded tasks.</p>
        ) : null}
      </div>
    </section>
  );
}

export function ColumnOverlay({
  column,
  taskCount,
}: {
  column: ColumnView;
  taskCount: number;
}) {
  return (
    <section
      className="board-column column-overlay-content"
      style={{ '--column-color': column.color } as CSSProperties}
      aria-hidden="true"
    >
      <header className="column-header">
        <div className="column-identity">
          <span className="column-dot" aria-hidden="true" />
          <h2 className="column-title">{column.title}</h2>
          <span className="column-count">{taskCount}</span>
        </div>
      </header>
    </section>
  );
}
