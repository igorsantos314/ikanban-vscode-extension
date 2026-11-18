import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnView, TaskView } from '../../shared/board';
import { TaskCard } from './TaskCard';

export function BoardColumn({
  column,
  tasks,
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
      className={`board-column ${isOver ? 'board-column-over' : ''}`}
      style={{ borderTopColor: column.color }}
      aria-label={`${column.title} column`}
    >
      <header className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{column.title}</h2>
          <p className="text-xs opacity-70" aria-label={`${tasks.length} tasks`}>
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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

      <div className="column-scroll flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onMoveLeft={canMoveLeft ? onMoveTaskLeft : undefined}
              onMoveRight={canMoveRight ? onMoveTaskRight : undefined}
              dragDisabled={dragDisabled}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-center text-xs opacity-60">
            No tasks yet
          </p>
        ) : null}
      </div>

      <footer className="border-t p-2">
        <button
          type="button"
          className="btn w-full"
          onClick={() => onAddTask(column)}
          aria-label={`Add task to ${column.title}`}
        >
          + Add task
        </button>
      </footer>
    </section>
  );
}
