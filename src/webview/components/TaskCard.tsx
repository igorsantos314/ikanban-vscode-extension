import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskView } from '../../shared/board';
import { getChecklistProgress } from '../../domain/checklist';
import type { CardLayout } from '../cardLayout';
import { formatDeadline } from '../formatDeadline';
import { formatTimestamp } from '../formatTimestamp';
import { PRIORITY_VISUALS, PriorityIcon } from '../priorityVisuals';
import { ChecklistProgress } from './ChecklistProgress';
import { TagChip } from './TagChip';

export type KeyboardMoveDirection = 'left' | 'right' | 'up' | 'down';

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

function CalendarIcon() {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

interface TaskCardContentProps {
  task: TaskView;
  cardLayout: CardLayout;
}

export function TaskCardContent({ task, cardLayout }: TaskCardContentProps) {
  const compact = cardLayout === 'compact';
  const priority = PRIORITY_VISUALS[task.priority];
  const deadline = formatDeadline(task.dueAt, { compact });
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

  if (compact) {
    return (
      <>
        <span className="task-card-compact-title" title={task.title}>
          {task.title}
        </span>
        <div className="task-card-compact-meta">
          <span
            className={`priority-badge priority-${task.priority} priority-badge-compact`}
            title={`Priority: ${priority.label}`}
            aria-label={`Priority: ${priority.label}`}
          >
            <PriorityIcon priority={task.priority} />
          </span>
          {progress.total > 0 ? (
            <ChecklistProgress compact completed={progress.completed} total={progress.total} />
          ) : null}
          {task.tags.length > 0 ? (
            <span className="task-card-compact-tags">
              {task.tags.map((tag) => (
                <TagChip key={tag} tag={tag} compact />
              ))}
            </span>
          ) : null}
          {deadline ? (
            <time
              className={`task-card-deadline ${deadline.overdue ? 'task-card-deadline-overdue' : ''}`}
              dateTime={task.dueAt}
              title={`Deadline: ${deadline.full}${deadline.overdue ? ' (overdue)' : ''}`}
              aria-label={`Deadline ${deadline.full}${deadline.overdue ? ', overdue' : ''}`}
            >
              {deadline.label}
            </time>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="task-card-meta">
        <span
          className={`priority-badge priority-${task.priority}`}
          title={`Priority: ${priority.label}`}
          aria-label={`Priority: ${priority.label}`}
        >
          <PriorityIcon priority={task.priority} />
          <span>{priority.label}</span>
        </span>
      </div>

      <span className="task-card-title" title={task.title}>
        {task.title}
      </span>

      {task.description ? <p className="task-card-description">{task.description}</p> : null}

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
            <ChecklistProgress completed={progress.completed} total={progress.total} />
          ) : null}
          {deadline ? (
            <span
              className={`task-card-footer-item task-card-deadline ${
                deadline.overdue ? 'task-card-deadline-overdue' : ''
              }`}
            >
              <CalendarIcon />
              <time
                dateTime={task.dueAt}
                title={`Deadline: ${deadline.full}${deadline.overdue ? ' (overdue)' : ''}`}
              >
                {deadline.label}
              </time>
              {deadline.overdue ? (
                <span className="task-card-overdue-label">overdue</span>
              ) : null}
            </span>
          ) : null}
          <span className="task-card-footer-item">
            <ClockIcon />
            <time dateTime={task.updatedAt} title={task.updatedAt}>
              {formatTimestamp(task.updatedAt)}
            </time>
          </span>
        </div>
      </div>
    </>
  );
}

export function TaskCard({
  task,
  cardLayout,
  onEdit,
  onKeyboardMove,
  dragDisabled,
}: {
  task: TaskView;
  cardLayout: CardLayout;
  onEdit(task: TaskView): void;
  onKeyboardMove?(task: TaskView, direction: KeyboardMoveDirection): void;
  dragDisabled?: boolean;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { kind: 'task' },
    disabled: dragDisabled,
  });

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
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      aria-keyshortcuts="Enter Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
      title="Click to open. Drag to move. Alt+Arrow moves between columns or positions."
      onClick={() => onEdit(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEdit(task);
          return;
        }
        if (!event.altKey || !onKeyboardMove) {
          return;
        }
        const directions: Record<string, KeyboardMoveDirection | undefined> = {
          ArrowLeft: 'left',
          ArrowRight: 'right',
          ArrowUp: 'up',
          ArrowDown: 'down',
        };
        const direction = directions[event.key];
        if (direction) {
          event.preventDefault();
          onKeyboardMove(task, direction);
        }
      }}
      {...listeners}
    >
      <TaskCardContent task={task} cardLayout={cardLayout} />
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
