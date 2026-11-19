import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskView } from '../../shared/board';
import { getChecklistProgress } from '../../domain/checklist';
import type { CardLayout } from '../cardLayout';
import { formatTimestamp } from '../formatTimestamp';
import { PRIORITY_VISUALS, PriorityIcon } from '../priorityVisuals';
import { ChecklistProgress } from './ChecklistProgress';
import { TagChip } from './TagChip';

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

interface TaskCardContentProps {
  task: TaskView;
  cardLayout: CardLayout;
  dragHandle?: ReactNode;
  onEdit?(task: TaskView): void;
  onDelete?(task: TaskView): void;
  onMoveLeft?(task: TaskView): void;
  onMoveRight?(task: TaskView): void;
}

export function TaskCardContent({
  task,
  cardLayout,
  dragHandle,
  onEdit,
  onDelete,
  onMoveLeft,
  onMoveRight,
}: TaskCardContentProps) {
  const compact = cardLayout === 'compact';
  const priority = PRIORITY_VISUALS[task.priority];
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
    <>
      <div className="task-card-meta">
        {dragHandle ?? <span className="drag-handle drag-handle-spacer" aria-hidden="true">⋮⋮</span>}
        <span
          className={`priority-badge priority-${task.priority} ${compact ? 'priority-badge-compact' : ''}`}
          title={`Priority: ${priority.label}`}
          aria-label={`Priority: ${priority.label}`}
        >
          <PriorityIcon priority={task.priority} />
          {compact ? null : <span>{priority.label}</span>}
        </span>
      </div>

      {onEdit ? (
        <button type="button" className="task-card-title" onClick={() => onEdit(task)}>
          {task.title}
        </button>
      ) : (
        <span className="task-card-title">{task.title}</span>
      )}

      {!compact && task.description ? (
        <p className="task-card-description">{task.description}</p>
      ) : null}

      {task.tags.length > 0 ? (
        <div className="task-card-tags">
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} compact={compact} />
          ))}
        </div>
      ) : null}

      <div className="task-card-footer">
        <div className="flex flex-wrap items-center gap-3">
          {progress.total > 0 ? (
            <ChecklistProgress completed={progress.completed} total={progress.total} />
          ) : null}
          {!compact ? (
            <span className="task-card-footer-item">
              <ClockIcon />
              <time dateTime={task.updatedAt} title={task.updatedAt}>
                {formatTimestamp(task.updatedAt)}
              </time>
            </span>
          ) : null}
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
          {onDelete ? (
            <button
              type="button"
              className="icon-button icon-button-danger"
              aria-label={`Delete task ${task.title}`}
              onClick={() => onDelete(task)}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function TaskCard({
  task,
  cardLayout,
  onEdit,
  onDelete,
  onMoveLeft,
  onMoveRight,
  dragDisabled,
}: {
  task: TaskView;
  cardLayout: CardLayout;
  onEdit(task: TaskView): void;
  onDelete(task: TaskView): void;
  onMoveLeft?(task: TaskView): void;
  onMoveRight?(task: TaskView): void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: dragDisabled });

  const dragHandle = (
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
  );

  return (
    <article
      ref={setNodeRef}
      className={`task-card ${cardLayout === 'compact' ? 'task-card-compact' : ''} ${
        isDragging ? 'task-card-placeholder' : ''
      }`}
      style={
        isDragging
          ? undefined
          : { transform: CSS.Translate.toString(transform), transition }
      }
      data-task-id={task.id}
    >
      <TaskCardContent
        task={task}
        cardLayout={cardLayout}
        dragHandle={dragHandle}
        onEdit={onEdit}
        onDelete={onDelete}
        {...(onMoveLeft ? { onMoveLeft } : {})}
        {...(onMoveRight ? { onMoveRight } : {})}
      />
    </article>
  );
}

export function TaskCardOverlay({
  task,
  cardLayout,
}: {
  task: TaskView;
  cardLayout: CardLayout;
}) {
  return (
    <div
      className={`task-card task-card-overlay-content ${
        cardLayout === 'compact' ? 'task-card-compact' : ''
      }`}
      aria-hidden="true"
    >
      <TaskCardContent task={task} cardLayout={cardLayout} />
    </div>
  );
}
