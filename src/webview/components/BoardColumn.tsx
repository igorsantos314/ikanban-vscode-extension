import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnView, TaskView } from '../../shared/board';
import type { CardLayout } from '../cardLayout';
import { TaskCard } from './TaskCard';

export function BoardColumn({
  column,
  tasks,
  cardLayout,
  isDropTarget,
  canMoveLeft,
  canMoveRight,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onMoveTaskLeft,
  onMoveTaskRight,
  onEditColumn,
  onDeleteColumn,
  onMoveColumnLeft,
  onMoveColumnRight,
  dragDisabled,
}: {
  column: ColumnView;
  tasks: readonly TaskView[];
  cardLayout: CardLayout;
  isDropTarget?: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onAddTask(column: ColumnView): void;
  onEditTask(task: TaskView): void;
  onDeleteTask(task: TaskView): void;
  onMoveTaskLeft(task: TaskView): void;
  onMoveTaskRight(task: TaskView): void;
  onEditColumn(column: ColumnView): void;
  onDeleteColumn(column: ColumnView): void;
  onMoveColumnLeft(column: ColumnView): void;
  onMoveColumnRight(column: ColumnView): void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver || isDropTarget ? 'board-column-over' : ''}`}
      style={{ '--column-color': column.color } as CSSProperties}
      aria-label={`${column.title} column`}
    >
      <header className="column-header">
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
        <div className="column-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${column.title} column left`}
            disabled={!canMoveLeft}
            onClick={() => onMoveColumnLeft(column)}
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${column.title} column right`}
            disabled={!canMoveRight}
            onClick={() => onMoveColumnRight(column)}
          >
            ›
          </button>
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
              onDelete={onDeleteTask}
              onMoveLeft={canMoveLeft ? onMoveTaskLeft : undefined}
              onMoveRight={canMoveRight ? onMoveTaskRight : undefined}
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
