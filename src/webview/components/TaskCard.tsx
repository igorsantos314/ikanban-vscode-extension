import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskView } from '../../shared/board';
import { getChecklistProgress } from '../../domain/checklist';
import { formatTimestamp } from '../formatTimestamp';
import { TagChip } from './TagChip';

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
} as const;

function ChecklistIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

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
      <div className="task-card-meta">
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
        <span
          className={`priority-badge priority-${task.priority}`}
          title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      <button
        type="button"
        className="task-card-title"
        onClick={() => onEdit(task)}
      >
        {task.title}
      </button>

      {task.description ? (
        <p className="task-card-description">{task.description}</p>
      ) : null}

      {task.tags.length > 0 ? (
        <div className="task-card-tags">
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

      <div className="task-card-footer">
        <div className="flex flex-wrap items-center gap-3">
          {progress.total > 0 ? (
            <span
              className="task-card-footer-item"
              aria-label={`Checklist progress ${progress.completed} of ${progress.total}`}
            >
              <ChecklistIcon />
              <span>Checklist {progress.completed}/{progress.total}</span>
            </span>
          ) : null}
          <span className="task-card-footer-item">
            <ClockIcon />
            <time dateTime={task.updatedAt} title={task.updatedAt}>
              {formatTimestamp(task.updatedAt)}
            </time>
          </span>
        </div>
        <div className="task-card-actions">
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
      </div>
    </article>
  );
}
