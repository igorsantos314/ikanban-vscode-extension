import type { CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnView, TaskView } from '../../shared/board';
import type { CardLayout } from '../cardLayout';
import { TaskCard, type KeyboardMoveDirection } from './TaskCard';

export function BoardColumn({
  column,
  tasks,
  cardLayout,
  isDropTarget,
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
  onAddTask(column: ColumnView): void;
  onEditTask(task: TaskView): void;
  onKeyboardMoveTask(task: TaskView, direction: KeyboardMoveDirection): void;
  onReorderColumn(column: ColumnView, direction: -1 | 1): void;
  onEditColumn(column: ColumnView): void;
  onDeleteColumn(column: ColumnView): void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
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
            aria-label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
          >
            {tasks.length}
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

      <div className="column-scroll">
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
        {tasks.length === 0 ? (
          <p className="column-empty">No tasks yet</p>
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
