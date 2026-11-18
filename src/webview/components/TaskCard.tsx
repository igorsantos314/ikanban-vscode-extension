import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskView } from '../../shared/board';
import { getChecklistProgress } from '../../domain/checklist';
import { TagChip } from './TagChip';

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
} as const;

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onMoveLeft,
  onMoveRight,
  dragDisabled,
}: {
  task: TaskView;
  onEdit(task: TaskView): void;
  onDelete(task: TaskView): void;
  onMoveLeft?(task: TaskView): void;
  onMoveRight?(task: TaskView): void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: dragDisabled });

  const progress = task.checklists.reduce(
    (accumulator, checklist) => {
      const current = getChecklistProgress(checklist);
      return {
        completed: accumulator.completed + current.completed,
        total: accumulator.total + current.total,
      };
    },
    { completed: 0, total: 0 },
  );

  return (
    <article
      ref={setNodeRef}
      className={`task-card ${isDragging ? 'task-card-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag task ${task.title}`}
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          className="line-clamp-3 flex-1 text-left font-semibold hover:underline"
          onClick={() => onEdit(task)}
        >
          {task.title}
        </button>
        <span
          className={`priority-badge priority-${task.priority}`}
          title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      {task.description ? (
        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs opacity-80">
          {task.description}
        </p>
      ) : null}

      {task.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

      {progress.total > 0 ? (
        <div className="mt-2 text-xs" aria-label={`Checklist progress ${progress.completed} of ${progress.total}`}>
          Checklist {progress.completed}/{progress.total}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end gap-1">
        {onMoveLeft ? (
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${task.title} to the previous column`}
            onClick={() => onMoveLeft(task)}
          >
            ←
          </button>
        ) : null}
        {onMoveRight ? (
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${task.title} to the next column`}
            onClick={() => onMoveRight(task)}
          >
            →
          </button>
        ) : null}
        <button
          type="button"
          className="icon-button icon-button-danger"
          aria-label={`Delete task ${task.title}`}
          onClick={() => onDelete(task)}
        >
          ×
        </button>
      </div>
    </article>
  );
}
