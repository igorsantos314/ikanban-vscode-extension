import { useMemo, useState } from 'react';
import type { TagId } from '../../domain/tags';
import type { Priority } from '../../domain/types';
import { PRIORITIES } from '../../domain/types';
import { parseLocalDeadline, splitDueAt } from '../../domain/deadline';
import type { ColumnView, TaskView } from '../../shared/board';
import { formatTimestamp } from '../formatTimestamp';
import { ChecklistEditor } from './ChecklistEditor';
import type { ChecklistDraftState } from './checklistDraft';
import { DeadlineInput, type DeadlineDraft } from './DeadlineInput';
import { Modal } from './Modal';
import { TagSelector } from './TagChip';

export interface TaskDialogPayload {
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  tags: TagId[];
  checklists: ChecklistDraftState[];
  dueAt: string | null;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function TaskDialog({
  task,
  initialColumnId,
  columns,
  onSave,
  onClose,
  onDelete,
}: {
  task?: TaskView;
  initialColumnId?: string;
  columns: readonly ColumnView[];
  onSave(payload: TaskDialogPayload): Promise<void>;
  onClose(): void;
  onDelete?(task: TaskView): void;
}) {
  const defaultColumnId = task?.columnId ?? initialColumnId ?? columns[0]?.id ?? '';
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [tags, setTags] = useState<TagId[]>([...(task?.tags ?? [])]);
  const [checklists, setChecklists] = useState<ChecklistDraftState[]>(
    task?.checklists.map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
      })),
    })) ?? [],
  );
  const [deadline, setDeadline] = useState<DeadlineDraft>(() => {
    const parts = task?.dueAt ? splitDueAt(task.dueAt) : null;
    return parts ?? { date: '', time: '' };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const initialDeadline = useMemo(() => {
    const parts = task?.dueAt ? splitDueAt(task.dueAt) : null;
    return parts ?? { date: '', time: '' };
  }, [task]);

  const initialState = useMemo(
    () =>
      JSON.stringify({
        title: task?.title ?? '',
        description: task?.description ?? '',
        columnId: defaultColumnId,
        priority: task?.priority ?? 'medium',
        tags: task?.tags ?? [],
        deadline: initialDeadline,
        checklists:
          task?.checklists.map((checklist) => ({
            id: checklist.id,
            title: checklist.title,
            items: checklist.items.map((item) => ({
              id: item.id,
              text: item.text,
              completed: item.completed,
            })),
          })) ?? [],
      }),
    [task, defaultColumnId, initialDeadline],
  );

  const currentState = JSON.stringify({
    title,
    description,
    columnId,
    priority,
    tags,
    deadline,
    checklists,
  });
  const dirty = currentState !== initialState;

  const requestClose = () => {
    if (saving) {
      return;
    }
    if (dirty) {
      setDiscardPrompt(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (saving) {
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) {
      nextErrors.title = 'Task title is required.';
    }
    if (!columnId) {
      nextErrors.columnId = 'Select a column for this task.';
    }
    const parsedDeadline = parseLocalDeadline(deadline.date, deadline.time);
    if (!parsedDeadline.ok) {
      nextErrors.deadline = parsedDeadline.message;
    }
    for (const checklist of checklists) {
      if (!checklist.title.trim()) {
        nextErrors[`checklists.${checklist.id}.title`] = 'Checklist title is required.';
      }
      for (const item of checklist.items) {
        if (!item.text.trim()) {
          nextErrors[`checklists.${checklist.id}.items.${item.id}.text`] =
            'Checklist item text is required.';
        }
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Fix the highlighted fields before saving.');
      return;
    }
    if (!parsedDeadline.ok) {
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await onSave({
        columnId,
        title: title.trim(),
        description,
        priority,
        tags,
        dueAt: parsedDeadline.dueAt ?? null,
        checklists: checklists.map((checklist) => ({
          id: checklist.id,
          title: checklist.title.trim(),
          items: checklist.items.map((item) => ({
            id: item.id,
            text: item.text.trim(),
            completed: item.completed,
          })),
        })),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={task ? task.title : 'Create task'}
      titleAdornment={
        <span
          className={`priority-badge priority-${priority}`}
          title={`Priority: ${PRIORITY_LABELS[priority]}`}
        >
          {PRIORITY_LABELS[priority]}
        </span>
      }
      wide
      onRequestClose={requestClose}
      footer={
        discardPrompt ? (
          <>
            <span role="alert" className="mr-auto text-sm">
              Discard unsaved changes?
            </span>
            <button type="button" className="btn" onClick={() => setDiscardPrompt(false)}>
              Keep editing
            </button>
            <button type="button" className="btn btn-danger" onClick={onClose}>
              Discard
            </button>
          </>
        ) : (
          <>
            {task && onDelete ? (
              <button
                type="button"
                className="btn btn-danger dialog-delete"
                onClick={() => onDelete(task)}
                disabled={saving}
              >
                <TrashIcon />
                Delete task
              </button>
            ) : null}
            <button type="button" className="btn btn-cancel" onClick={requestClose} disabled={saving}>
              <XIcon />
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-save"
              onClick={() => void submit()}
              disabled={saving}
            >
              <CheckIcon />
              {saving ? 'Saving…' : task ? 'Save task' : 'Create task'}
            </button>
          </>
        )
      }
    >
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError ? (
          <p role="alert" className="error-text">
            {formError}
          </p>
        ) : null}

        {task ? (
          <dl aria-label="Task timestamps" className="dialog-metadata">
            <div className="dialog-metadata-item">
              <dt className="dialog-metadata-label">Created</dt>
              <dd>
                <time dateTime={task.createdAt} title={task.createdAt}>
                  {formatTimestamp(task.createdAt)}
                </time>
              </dd>
            </div>
            <div className="dialog-metadata-item">
              <dt className="dialog-metadata-label">Last updated</dt>
              <dd>
                <time dateTime={task.updatedAt} title={task.updatedAt}>
                  {formatTimestamp(task.updatedAt)}
                </time>
              </dd>
            </div>
          </dl>
        ) : null}

        <section className="dialog-section" aria-labelledby="task-details-heading">
          <h3 id="task-details-heading" className="dialog-section-title">
            Details
          </h3>
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              value={title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {errors.title ? (
            <p id="task-title-error" role="alert" className="error-text">
              {errors.title}
            </p>
          ) : null}

          <label className="field">
            <span>Description</span>
            <textarea
              className="input min-h-24"
              value={description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </section>

        <section className="dialog-section" aria-labelledby="task-organization-heading">
          <h3 id="task-organization-heading" className="dialog-section-title">
            Organization
          </h3>
          <div className="dialog-grid">
            <label className="field">
              <span>Column</span>
              <select
                className="input"
                value={columnId}
                aria-invalid={Boolean(errors.columnId)}
                aria-describedby={errors.columnId ? 'task-column-error' : undefined}
                onChange={(event) => setColumnId(event.target.value)}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select
                className="input"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {errors.columnId ? (
            <p id="task-column-error" role="alert" className="error-text">
              {errors.columnId}
            </p>
          ) : null}

          <div className="field">
            <span>Tags</span>
            <TagSelector selected={tags} onChange={setTags} />
          </div>

          <DeadlineInput
            value={deadline}
            onChange={setDeadline}
            error={errors.deadline}
          />
        </section>

        <section className="dialog-section" aria-labelledby="task-checklists-heading">
          <h3 id="task-checklists-heading" className="dialog-section-title">
            Checklists
          </h3>
          <ChecklistEditor checklists={checklists} errors={errors} onChange={setChecklists} />
        </section>
      </form>
    </Modal>
  );
}
