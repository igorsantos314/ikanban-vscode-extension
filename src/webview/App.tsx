import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { BoardSnapshot, ColumnView, TaskView } from '../shared/board';
import type { BoardPushMessage } from '../shared/protocol';
import {
  ApiError,
  createWebviewBoardClient,
  type BoardClientLike,
} from './api/boardClient';
import { BoardColumn } from './components/BoardColumn';
import { BoardHeader } from './components/BoardHeader';
import { ColumnDialog, type ColumnFormValues } from './components/ColumnDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { TaskDialog, type TaskDialogPayload } from './components/TaskDialog';
import { ValidationPanel } from './components/ValidationPanel';
import {
  boardReducer,
  computeMoveTarget,
  initialBoardState,
  tasksForColumn,
} from './state/boardState';

export function App({ client }: { client?: BoardClientLike }) {
  const ownedClient = useMemo(() => (client ? undefined : createWebviewBoardClient()), [client]);
  const boardClient = client ?? ownedClient;
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const [moveInProgress, setMoveInProgress] = useState(false);

  useEffect(() => {
    if (!boardClient) {
      return undefined;
    }
    let cancelled = false;
    dispatch({ type: 'loading' });
    boardClient
      .request<BoardSnapshot>('board/load', {})
      .then((snapshot) => {
        if (!cancelled) {
          dispatch({ type: 'loaded', snapshot });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({ type: 'failed', message: messageOf(error) });
        }
      });
    const unsubscribe = boardClient.subscribe((message: BoardPushMessage) => {
      if (message.type === 'board/updated') {
        dispatch({ type: 'loaded', snapshot: message.snapshot });
      } else {
        dispatch({ type: 'banner', banner: { kind: 'error', message: message.error.message } });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [boardClient]);

  useEffect(
    () => () => {
      ownedClient?.dispose();
    },
    [ownedClient],
  );

  const snapshot = state.snapshot;
  const columns = snapshot?.columns ?? [];
  const tasks = snapshot?.tasks ?? [];

  const reportError = useCallback((error: unknown) => {
    dispatch({
      type: 'banner',
      banner: { kind: 'error', message: messageOf(error) },
    });
  }, []);

  const applySnapshot = useCallback(
    (next: BoardSnapshot) => dispatch({ type: 'loaded', snapshot: next }),
    [],
  );

  const load = useCallback(async () => {
    if (!boardClient) {
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const next = await boardClient.request<BoardSnapshot>('board/load', {});
      applySnapshot(next);
    } catch (error) {
      reportError(error);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }, [applySnapshot, boardClient, reportError]);

  const initialize = useCallback(async () => {
    if (!boardClient) {
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const next = await boardClient.request<BoardSnapshot>('board/initialize', {});
      applySnapshot(next);
      dispatch({ type: 'banner', banner: { kind: 'info', message: 'Board initialized.' } });
    } catch (error) {
      reportError(error);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }, [applySnapshot, boardClient, reportError]);

  const validate = useCallback(async () => {
    if (!boardClient) {
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const next = await boardClient.request<BoardSnapshot>('board/validate', {});
      applySnapshot(next);
      const errors = next.issues.filter((issue) => issue.severity === 'error').length;
      const warnings = next.issues.filter((issue) => issue.severity === 'warning').length;
      dispatch({
        type: 'banner',
        banner:
          errors + warnings === 0
            ? { kind: 'info', message: 'Board is valid.' }
            : {
                kind: 'warning',
                message: `Validation found ${errors} error(s) and ${warnings} warning(s).`,
              },
      });
      if (next.issues.length > 0) {
        dispatch({ type: 'validation', open: true });
      }
    } catch (error) {
      reportError(error);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  }, [applySnapshot, boardClient, reportError]);

  const saveTask = async (payload: TaskDialogPayload) => {
    if (!boardClient || !state.taskDialog) {
      return;
    }
    const target = state.taskDialog;
    if (target.mode === 'edit') {
      const updated = await boardClient.request<TaskView>('task/update', {
        taskId: target.task.id,
        columnId: payload.columnId,
        expectedRevision: target.task.revision,
        ...taskPayload(payload),
      });
      dispatch({ type: 'upsert-task', task: updated });
    } else {
      const created = await boardClient.request<TaskView>('task/create', {
        columnId: payload.columnId,
        ...taskPayload(payload),
      });
      dispatch({ type: 'upsert-task', task: created });
    }
    dispatch({ type: 'task-dialog', target: null });
  };

  const deleteTask = async (task: TaskView) => {
    if (!boardClient) {
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      await boardClient.request('task/delete', {
        taskId: task.id,
        columnId: task.columnId,
        expectedRevision: task.revision,
      });
      dispatch({ type: 'remove-task', taskId: task.id });
      dispatch({ type: 'confirm', target: null });
    } catch (error) {
      reportError(error);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  };

  const moveTask = useCallback(
    async (task: TaskView, toColumnId: string, targetIndex: number) => {
      if (!boardClient || moveInProgress) {
        return;
      }
      setMoveInProgress(true);
      try {
        const next = await boardClient.request<BoardSnapshot>('task/move', {
          taskId: task.id,
          fromColumnId: task.columnId,
          toColumnId,
          targetIndex,
          expectedRevision: task.revision,
        });
        applySnapshot(next);
      } catch (error) {
        reportError(error);
      } finally {
        setMoveInProgress(false);
      }
    },
    [applySnapshot, boardClient, moveInProgress, reportError],
  );

  const moveTaskToAdjacentColumn = (task: TaskView, direction: -1 | 1) => {
    const index = columns.findIndex((column) => column.id === task.columnId);
    const target = columns[index + direction];
    if (!target) {
      return;
    }
    const targetIndex = tasks.filter((entry) => entry.columnId === target.id).length;
    void moveTask(task, target.id, targetIndex);
  };

  const moveColumn = async (column: ColumnView, direction: -1 | 1) => {
    if (!boardClient || !snapshot?.board) {
      return;
    }
    const ids = snapshot.columns.map((entry) => entry.id);
    const index = ids.indexOf(column.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) {
      return;
    }
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      const next = await boardClient.request<BoardSnapshot>('column/reorder', {
        columnIds: ids,
        expectedBoardRevision: snapshot.board.revision,
      });
      applySnapshot(next);
    } catch (error) {
      reportError(error);
    }
  };

  const submitColumn = async (values: ColumnFormValues) => {
    if (!boardClient || !state.columnDialog) {
      return;
    }
    if (state.columnDialog.mode === 'edit') {
      const next = await boardClient.request<BoardSnapshot>('column/update', {
        id: state.columnDialog.column.id,
        title: values.title,
        color: values.color,
        expectedRevision: state.columnDialog.column.revision,
      });
      applySnapshot(next);
    } else {
      if (!snapshot?.board) {
        throw new Error('The board revision is unavailable. Refresh and try again.');
      }
      const next = await boardClient.request<BoardSnapshot>('column/create', {
        title: values.title,
        color: values.color,
        expectedBoardRevision: snapshot.board.revision,
      });
      applySnapshot(next);
    }
    dispatch({ type: 'column-dialog', target: null });
  };

  const deleteColumn = async (column: ColumnView) => {
    if (!boardClient || !snapshot?.board) {
      return;
    }
    dispatch({ type: 'busy', busy: true });
    try {
      const next = await boardClient.request<BoardSnapshot>('column/delete', {
        id: column.id,
        expectedBoardRevision: snapshot.board.revision,
      });
      applySnapshot(next);
      dispatch({ type: 'confirm', target: null });
    } catch (error) {
      reportError(error);
    } finally {
      dispatch({ type: 'busy', busy: false });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : undefined;
    if (!overId) {
      return;
    }
    const target = computeMoveTarget(tasks, activeId, overId);
    const task = tasks.find((entry) => entry.id === activeId);
    if (!target || !task) {
      return;
    }
    void moveTask(task, target.toColumnId, target.targetIndex);
  };

  return (
    <div className="flex h-full flex-col">
      {state.banner ? (
        <div className={`banner banner-${state.banner.kind}`} role="status">
          <span className="flex-1">{state.banner.message}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => dispatch({ type: 'dismiss-banner' })}
          >
            ×
          </button>
        </div>
      ) : null}

      {state.status === 'loading' ? <LoadingState /> : null}
      {state.status === 'empty' ? <EmptyState onInitialize={() => void initialize()} /> : null}
      {state.status === 'error' && snapshot ? (
        <InvalidState
          snapshot={snapshot}
          onRefresh={() => void load()}
          onShowValidation={() => dispatch({ type: 'validation', open: true })}
        />
      ) : null}
      {state.status === 'error' && !snapshot ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <h1 className="text-xl font-semibold">The board could not be loaded</h1>
            <p className="mt-2 text-sm opacity-75">
              {state.banner?.message ?? 'Refresh to try again.'}
            </p>
            <button type="button" className="btn btn-primary mt-4" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      {state.status === 'ready' && snapshot?.board ? (
        <>
          <BoardHeader
            boardName={snapshot.board.name}
            workspaceName={snapshot.workspaceName}
            columnCount={snapshot.columns.length}
            taskCount={snapshot.tasks.length}
            errorCount={snapshot.issues.filter((issue) => issue.severity === 'error').length}
            warningCount={snapshot.issues.filter((issue) => issue.severity === 'warning').length}
            busy={state.busy || moveInProgress}
            onRefresh={() => void load()}
            onValidate={() => void validate()}
            onAddColumn={() => dispatch({ type: 'column-dialog', target: { mode: 'create' } })}
            onShowValidation={() => dispatch({ type: 'validation', open: true })}
          />
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="board-scroll flex min-h-0 flex-1 items-stretch overflow-x-auto">
              {snapshot.columns.map((column, index) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={tasksForColumn(tasks, column.id)}
                  canMoveLeft={index > 0}
                  canMoveRight={index < snapshot.columns.length - 1}
                  dragDisabled={state.busy || moveInProgress}
                  onAddTask={(target) =>
                    dispatch({
                      type: 'task-dialog',
                      target: { mode: 'create', columnId: target.id },
                    })
                  }
                  onEditTask={(task) =>
                    dispatch({ type: 'task-dialog', target: { mode: 'edit', task } })
                  }
                  onDeleteTask={(task) => dispatch({ type: 'confirm', target: { kind: 'task', task } })}
                  onMoveTaskLeft={(task) => moveTaskToAdjacentColumn(task, -1)}
                  onMoveTaskRight={(task) => moveTaskToAdjacentColumn(task, 1)}
                  onEditColumn={(target) =>
                    dispatch({
                      type: 'column-dialog',
                      target: { mode: 'edit', column: target },
                    })
                  }
                  onDeleteColumn={(target) =>
                    dispatch({ type: 'confirm', target: { kind: 'column', column: target } })
                  }
                  onMoveColumnLeft={(target) => void moveColumn(target, -1)}
                  onMoveColumnRight={(target) => void moveColumn(target, 1)}
                />
              ))}
            </div>
          </DndContext>
        </>
      ) : null}

      {state.taskDialog && snapshot ? (
        <TaskDialog
          {...(state.taskDialog.mode === 'edit' ? { task: state.taskDialog.task } : {})}
          {...(state.taskDialog.mode === 'create'
            ? { initialColumnId: state.taskDialog.columnId }
            : {})}
          columns={snapshot.columns}
          onSave={saveTask}
          onClose={() => dispatch({ type: 'task-dialog', target: null })}
        />
      ) : null}

      {state.columnDialog ? (
        <ColumnDialog
          {...(state.columnDialog.mode === 'edit'
            ? { column: state.columnDialog.column }
            : {})}
          onSubmit={submitColumn}
          onClose={() => dispatch({ type: 'column-dialog', target: null })}
        />
      ) : null}

      {state.confirm ? (
        <ConfirmDialog
          title={state.confirm.kind === 'task' ? 'Delete task' : 'Delete column'}
          message={
            state.confirm.kind === 'task'
              ? `Delete “${state.confirm.task.title}”? This removes its YAML file.`
              : `Delete the “${state.confirm.column.title}” column? It must be empty.`
          }
          confirmLabel="Delete"
          busy={state.busy}
          onCancel={() => dispatch({ type: 'confirm', target: null })}
          onConfirm={() => {
            if (state.confirm?.kind === 'task') {
              void deleteTask(state.confirm.task);
            } else if (state.confirm?.kind === 'column') {
              void deleteColumn(state.confirm.column);
            }
          }}
        />
      ) : null}

      {state.validationOpen ? (
        <ValidationPanel
          issues={snapshot?.issues ?? []}
          onClose={() => dispatch({ type: 'validation', open: false })}
          onOpenIssue={(issue) => {
            if (!boardClient) {
              return;
            }
            void boardClient
              .request('file/open', {
                uri: issue.uri,
                ...(issue.range
                  ? {
                      range: {
                        startLine: issue.range.startLine,
                        startColumn: issue.range.startColumn,
                        endLine: issue.range.endLine,
                        endColumn: issue.range.endColumn,
                      },
                    }
                  : {}),
              })
              .catch(reportError);
          }}
        />
      ) : null}

    </div>
  );
}

function taskPayload(payload: TaskDialogPayload) {
  return {
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    tags: payload.tags,
    checklists: payload.checklists.map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
      })),
    })),
  };
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm opacity-70">Loading iKanban board…</p>
    </div>
  );
}

function EmptyState({ onInitialize }: { onInitialize(): void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-xl font-semibold">No iKanban board yet</h1>
        <p className="mt-2 text-sm opacity-75">
          Create a local, Git-friendly board with a <code>.ikanban</code> directory, three
          default columns and YAML task files.
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={onInitialize}>
          Initialize board
        </button>
      </div>
    </div>
  );
}

function InvalidState({
  snapshot,
  onRefresh,
  onShowValidation,
}: {
  snapshot: BoardSnapshot;
  onRefresh(): void;
  onShowValidation(): void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">The board could not be loaded</h1>
        <p className="mt-2 text-sm opacity-75">
          {snapshot.issues[0]?.message ?? 'The board configuration is invalid.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={onRefresh}>
            Refresh
          </button>
          <button type="button" className="btn" onClick={onShowValidation}>
            Show validation issues
          </button>
        </div>
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
