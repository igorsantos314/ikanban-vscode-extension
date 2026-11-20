import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TagId } from '../../domain/tags';
import type { Priority } from '../../domain/types';
import { PRIORITIES } from '../../domain/types';
import { parseLocalDeadline, splitDueAt } from '../../domain/deadline';
import type { ColumnView, TaskView } from '../../shared/board';
import { formatTimestamp } from '../formatTimestamp';
import { ChecklistEditor } from './ChecklistEditor';
import type { ChecklistDraftState } from './checklistDraft';
import { ClickToEditInput, ClickToEditTextarea } from './ClickToEditField';
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

interface TaskDialogTaskRef {
  id: string;
  revision: string;
}

export type { TaskDialogTaskRef };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

type SaveResult = 'saved' | 'invalid' | 'failed' | 'skipped';

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const TEXT_DEBOUNCE_MS = 400;

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

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function signatureOf(payload: TaskDialogPayload): string {
  return JSON.stringify(payload);
}

function signatureOfTask(task: TaskView): string {
  return signatureOf({
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    tags: task.tags,
    dueAt: task.dueAt ?? null,
    checklists: task.checklists.map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
      })),
    })),
  });
}

export function TaskDialog({
  task,
  initialColumnId,
  columns,
  onAutosave,
  onReload,
  onClose,
  onDelete,
  inert,
}: {
  task?: TaskView;
  initialColumnId?: string;
  columns: readonly ColumnView[];
  onAutosave(
    payload: TaskDialogPayload,
    current: TaskDialogTaskRef | null,
  ): Promise<TaskView>;
  onReload(taskId: string): Promise<TaskView>;
  onClose(): void;
  onDelete?(task: TaskView): void;
  inert?: boolean;
}) {
  const [currentTask, setCurrentTask] = useState<TaskView | undefined>(task);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [columnId, setColumnId] = useState(
    task?.columnId ?? initialColumnId ?? columns[0]?.id ?? '',
  );
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
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [discardPrompt, setDiscardPrompt] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const closingRef = useRef(false);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const nextDelayRef = useRef(TEXT_DEBOUNCE_MS);
  const lastSavedRef = useRef<string | null>(task ? signatureOfTask(task) : null);
  const taskRef = useRef<TaskView | undefined>(task);

  const draft = useMemo(
    () => ({
      title,
      description,
      columnId,
      priority,
      tags,
      checklists,
      deadline,
    }),
    [title, description, columnId, priority, tags, checklists, deadline],
  );
  const draftRef = useRef(draft);
  const draftSignature = signatureOf({
    columnId: draft.columnId,
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    tags: draft.tags,
    checklists: draft.checklists,
    dueAt: parseLocalDeadline(draft.deadline.date, draft.deadline.time).ok
      ? (parseLocalDeadline(draft.deadline.date, draft.deadline.time) as { dueAt?: string })
          .dueAt ?? null
      : `invalid:${draft.deadline.date}:${draft.deadline.time}`,
  });

  const buildPayload = useCallback(
    (value: typeof draft): { payload: TaskDialogPayload; errors: Record<string, string> } => {
      const nextErrors: Record<string, string> = {};
      if (!value.title.trim()) {
        nextErrors.title = 'Task title is required.';
      }
      if (!value.columnId) {
        nextErrors.columnId = 'Select a column for this task.';
      }
      for (const checklist of value.checklists) {
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
      const parsedDeadline = parseLocalDeadline(value.deadline.date, value.deadline.time);
      if (!parsedDeadline.ok) {
        nextErrors.deadline = parsedDeadline.message;
      }
      return {
        errors: nextErrors,
        payload: {
          columnId: value.columnId,
          title: value.title,
          description: value.description,
          priority: value.priority,
          tags: value.tags,
          dueAt: parsedDeadline.ok ? parsedDeadline.dueAt ?? null : null,
          checklists: value.checklists.map((checklist) => ({
            id: checklist.id,
            title: checklist.title,
            items: checklist.items.map((item) => ({
              id: item.id,
              text: item.text,
              completed: item.completed,
            })),
          })),
        },
      };
    },
    [],
  );

  const applyTask = useCallback((next: TaskView) => {
    taskRef.current = next;
    setCurrentTask(next);
    setTitle(next.title);
    setDescription(next.description);
    setColumnId(next.columnId);
    setPriority(next.priority);
    setTags([...next.tags]);
    setChecklists(
      next.checklists.map((checklist) => ({
        id: checklist.id,
        title: checklist.title,
        items: checklist.items.map((item) => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
        })),
      })),
    );
    const parts = next.dueAt ? splitDueAt(next.dueAt) : null;
    setDeadline(parts ?? { date: '', time: '' });
    lastSavedRef.current = signatureOfTask(next);
    setErrors({});
    setFormError(null);
    setStatus('saved');
  }, []);

  const saveNowRef = useRef<() => Promise<SaveResult>>(async () => 'skipped');

  const saveNow = useCallback(async (): Promise<SaveResult> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (savingRef.current) {
      queuedRef.current = true;
      return 'skipped';
    }

    const { payload, errors: nextErrors } = buildPayload(draftRef.current);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus('idle');
      setFormError(null);
      return 'invalid';
    }

    const taskId = taskRef.current?.id;
    if (taskRef.current && lastSavedRef.current === signatureOf(payload)) {
      setStatus('saved');
      return 'saved';
    }

    savingRef.current = true;
    setStatus('saving');
    setFormError(null);
    let result: SaveResult = 'saved';
    let needsAnother = false;
    try {
      const saved = await onAutosave(
        payload,
        taskRef.current
          ? { id: taskRef.current.id, revision: taskRef.current.revision }
          : null,
      );
      if (!mountedRef.current) {
        return 'saved';
      }
      if (!taskId) {
        applyTask(saved);
      } else {
        taskRef.current = saved;
        setCurrentTask(saved);
      }
      lastSavedRef.current = signatureOf(payload);
      setErrors({});
      setStatus('saved');
      needsAnother =
        queuedRef.current ||
        signatureOf(buildPayload(draftRef.current).payload) !== signatureOf(payload);
      queuedRef.current = false;
    } catch (error) {
      if (mountedRef.current) {
        const conflict =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'ConflictError';
        setStatus(conflict ? 'conflict' : 'error');
        setFormError(
          error instanceof Error ? error.message : 'Could not save the task.',
        );
        result = 'failed';
        if (closingRef.current) {
          closingRef.current = false;
          setDiscardPrompt(true);
        }
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current && result !== 'saved') {
        queuedRef.current = false;
      }
    }
    if (mountedRef.current && needsAnother) {
      void saveNowRef.current();
    } else if (mountedRef.current && closingRef.current && result === 'saved') {
      closingRef.current = false;
      onClose();
    }
    return result;
  }, [applyTask, buildPayload, onAutosave, onClose]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const delay = nextDelayRef.current;
    nextDelayRef.current = TEXT_DEBOUNCE_MS;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      void saveNowRef.current();
    }, delay);
  }, [draftSignature]);

  const requestClose = async () => {
    if (discardPrompt) {
      return;
    }
    if (savingRef.current) {
      closingRef.current = true;
      return;
    }
    if (!taskRef.current) {
      const { errors: nextErrors } = buildPayload(draftRef.current);
      if (Object.keys(nextErrors).length > 0) {
        onClose();
        return;
      }
    }
    const result = await saveNow();
    if (result === 'saved') {
      onClose();
    } else if (result === 'invalid' && !taskRef.current) {
      onClose();
    } else {
      setDiscardPrompt(true);
    }
  };

  const reload = async () => {
    if (!taskRef.current) {
      return;
    }
    setStatus('saving');
    try {
      const fresh = await onReload(taskRef.current.id);
      applyTask(fresh);
    } catch (error) {
      setStatus('error');
      setFormError(error instanceof Error ? error.message : 'Could not reload the task.');
    }
  };

  const statusText =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'conflict'
          ? 'Conflict — reload to continue'
          : status === 'error'
            ? 'Could not save'
            : 'Changes are saved automatically.';

  return (
    <Modal
      title={currentTask ? currentTask.title : 'Create task'}
      titleAdornment={
        <span
          className={`priority-badge priority-${priority}`}
          title={`Priority: ${PRIORITY_LABELS[priority]}`}
        >
          {PRIORITY_LABELS[priority]}
        </span>
      }
      wide
      inert={inert}
      onRequestClose={() => void requestClose()}
      footer={
        discardPrompt ? (
          <>
            <span role="alert" className="mr-auto text-sm">
              Discard unsaved changes?
            </span>
            <button type="button" className="btn" onClick={() => setDiscardPrompt(false)}>
              Keep editing
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (timerRef.current) {
                  clearTimeout(timerRef.current);
                }
                onClose();
              }}
            >
              Discard and close
            </button>
          </>
        ) : (
          <>
            {currentTask && onDelete ? (
              <button
                type="button"
                className="btn btn-danger dialog-delete"
                onClick={() => onDelete(currentTask)}
              >
                <TrashIcon />
                Delete task
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-back"
              onClick={() => void requestClose()}
            >
              <BackIcon />
              Voltar
            </button>
          </>
        )
      }
    >
      <div className={`dialog-autosave dialog-autosave-${status}`} role="status">
        <InfoIcon />
        <span className="flex-1">{statusText}</span>
        {status === 'conflict' && currentTask ? (
          <button type="button" className="btn" onClick={() => void reload()}>
            Reload
          </button>
        ) : null}
      </div>

      <form
        className="dialog-form"
        onSubmit={(event) => event.preventDefault()}
      >
        {formError ? (
          <p role="alert" className="error-text">
            {formError}
          </p>
        ) : null}

        {currentTask ? (
          <dl aria-label="Task timestamps" className="dialog-metadata">
            <div className="dialog-metadata-item">
              <dt className="dialog-metadata-label">Created</dt>
              <dd>
                <time dateTime={currentTask.createdAt} title={currentTask.createdAt}>
                  {formatTimestamp(currentTask.createdAt)}
                </time>
              </dd>
            </div>
            <div className="dialog-metadata-item">
              <dt className="dialog-metadata-label">Last updated</dt>
              <dd>
                <time dateTime={currentTask.updatedAt} title={currentTask.updatedAt}>
                  {formatTimestamp(currentTask.updatedAt)}
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
            <ClickToEditInput
              className="input"
              value={title}
              onValueChange={(value) => {
                setTitle(value);
              }}
              initiallyEditable={!currentTask}
              reveal={Boolean(errors.title)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
            />
          </label>
          {errors.title ? (
            <p id="task-title-error" role="alert" className="error-text">
              {errors.title}
            </p>
          ) : null}

          <label className="field">
            <span>Description</span>
            <ClickToEditTextarea
              className="input min-h-24"
              value={description}
              onValueChange={(value) => setDescription(value)}
              rows={4}
              initiallyEditable={!currentTask}
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
                onChange={(event) => {
                  nextDelayRef.current = 0;
                  setColumnId(event.target.value);
                }}
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
                onChange={(event) => {
                  nextDelayRef.current = 0;
                  setPriority(event.target.value as Priority);
                }}
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
            <TagSelector
              selected={tags}
              onChange={(next) => {
                nextDelayRef.current = 0;
                setTags(next);
              }}
            />
          </div>

          <DeadlineInput
            value={deadline}
            onChange={(next) => {
              nextDelayRef.current = 0;
              setDeadline(next);
            }}
            error={errors.deadline}
          />
        </section>

        <section className="dialog-section" aria-labelledby="task-checklists-heading">
          <h3 id="task-checklists-heading" className="dialog-section-title">
            Checklists
          </h3>
          <ChecklistEditor
            checklists={checklists}
            errors={errors}
            onChange={(next) => {
              nextDelayRef.current = 0;
              setChecklists(next);
            }}
          />
        </section>
      </form>
    </Modal>
  );
}
