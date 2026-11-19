import type { BoardSnapshot, ColumnView, TaskView } from '../../shared/board';
import { sortByPosition } from '../../domain/positions';

export type TaskDialogTarget =
  | { mode: 'create'; columnId: string }
  | { mode: 'edit'; task: TaskView };

export type ColumnDialogTarget =
  | { mode: 'create' }
  | { mode: 'edit'; column: ColumnView };

export type ConfirmTarget =
  | { kind: 'task'; task: TaskView }
  | { kind: 'column'; column: ColumnView };

export interface BannerMessage {
  kind: 'error' | 'info' | 'warning';
  message: string;
}

export interface BoardUiState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  snapshot: BoardSnapshot | null;
  banner: BannerMessage | null;
  taskDialog: TaskDialogTarget | null;
  columnDialog: ColumnDialogTarget | null;
  confirm: ConfirmTarget | null;
  validationOpen: boolean;
  busy: boolean;
}

export type BoardAction =
  | { type: 'loading' }
  | { type: 'loaded'; snapshot: BoardSnapshot }
  | { type: 'failed'; message: string }
  | { type: 'banner'; banner: BannerMessage }
  | { type: 'dismiss-banner' }
  | { type: 'task-dialog'; target: TaskDialogTarget | null }
  | { type: 'column-dialog'; target: ColumnDialogTarget | null }
  | { type: 'confirm'; target: ConfirmTarget | null }
  | { type: 'validation'; open: boolean }
  | { type: 'upsert-task'; task: TaskView }
  | { type: 'remove-task'; taskId: string }
  | { type: 'busy'; busy: boolean };

export const initialBoardState: BoardUiState = {
  status: 'loading',
  snapshot: null,
  banner: null,
  taskDialog: null,
  columnDialog: null,
  confirm: null,
  validationOpen: false,
  busy: false,
};

export function boardReducer(state: BoardUiState, action: BoardAction): BoardUiState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', busy: true, banner: null };
    case 'loaded':
      return {
        ...state,
        snapshot: action.snapshot,
        status: statusFor(action.snapshot),
        busy: false,
        banner: null,
      };
    case 'failed':
      return {
        ...state,
        status: 'error',
        busy: false,
        banner: { kind: 'error', message: action.message },
      };
    case 'banner':
      return { ...state, banner: action.banner };
    case 'dismiss-banner':
      return { ...state, banner: null };
    case 'task-dialog':
      return { ...state, taskDialog: action.target };
    case 'column-dialog':
      return { ...state, columnDialog: action.target };
    case 'confirm':
      return { ...state, confirm: action.target };
    case 'validation':
      return { ...state, validationOpen: action.open };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'upsert-task':
      return { ...state, snapshot: upsertTask(state.snapshot, action.task) };
    case 'remove-task':
      return { ...state, snapshot: removeTask(state.snapshot, action.taskId) };
  }
}

export function statusFor(snapshot: BoardSnapshot): BoardUiState['status'] {
  if (snapshot.board) {
    return 'ready';
  }
  return snapshot.canInitialize ? 'empty' : 'error';
}

function upsertTask(snapshot: BoardSnapshot | null, task: TaskView): BoardSnapshot | null {
  if (!snapshot) {
    return snapshot;
  }
  const without = snapshot.tasks.filter((entry) => entry.id !== task.id);
  const tasks = sortTasks(snapshot, [...without, task]);
  return withTasks(snapshot, tasks);
}

function removeTask(snapshot: BoardSnapshot | null, taskId: string): BoardSnapshot | null {
  if (!snapshot) {
    return snapshot;
  }
  return withTasks(
    snapshot,
    snapshot.tasks.filter((task) => task.id !== taskId),
  );
}

function sortTasks(snapshot: BoardSnapshot, tasks: TaskView[]): TaskView[] {
  const columnOrder = snapshot.board?.columnIds ?? snapshot.columns.map((column) => column.id);
  return [...tasks].sort((left, right) => {
    const columnDelta =
      columnOrder.indexOf(left.columnId) - columnOrder.indexOf(right.columnId);
    if (columnDelta !== 0) {
      return columnDelta;
    }
    const sorted = sortByPosition([left, right]);
    return sorted[0]?.id === left.id ? -1 : 1;
  });
}

function withTasks(snapshot: BoardSnapshot, tasks: TaskView[]): BoardSnapshot {
  return {
    ...snapshot,
    tasks,
    columns: snapshot.columns.map((column) => ({
      ...column,
      taskCount: tasks.filter((task) => task.columnId === column.id).length,
    })),
  };
}

export interface MoveTarget {
  toColumnId: string;
  targetIndex: number;
}

export function computeMoveTarget(
  tasks: readonly TaskView[],
  activeTaskId: string,
  overId: string,
): MoveTarget | null {
  const active = tasks.find((task) => task.id === activeTaskId);
  if (!active) {
    return null;
  }

  if (overId.startsWith('column:')) {
    const toColumnId = overId.slice('column:'.length);
    const targetIndex = tasks.filter(
      (task) => task.columnId === toColumnId && task.id !== activeTaskId,
    ).length;
    return { toColumnId, targetIndex };
  }

  if (overId === activeTaskId) {
    return null;
  }
  const overTask = tasks.find((task) => task.id === overId);
  if (!overTask) {
    return null;
  }
  const columnTasks = tasks
    .filter((task) => task.columnId === overTask.columnId && task.id !== activeTaskId)
    .sort((left, right) => left.position - right.position);
  const index = columnTasks.findIndex((task) => task.id === overTask.id);
  return { toColumnId: overTask.columnId, targetIndex: Math.max(0, index) };
}

export function tasksForColumn(
  tasks: readonly TaskView[],
  columnId: string,
): TaskView[] {
  return sortByPosition(tasks.filter((task) => task.columnId === columnId));
}

export type PreviewOrder = Record<string, string[]>;

export interface PreviewPosition {
  columnId: string;
  index: number;
}

export interface PreviewPointer {
  activeTop: number;
  overTop: number;
  overHeight: number;
}

export function buildPreviewOrder(
  columns: readonly { id: string }[],
  tasks: readonly TaskView[],
): PreviewOrder {
  const order: PreviewOrder = {};
  for (const column of columns) {
    order[column.id] = tasksForColumn(tasks, column.id).map((task) => task.id);
  }
  return order;
}

export function locateTaskInPreview(
  order: Readonly<PreviewOrder>,
  taskId: string,
): PreviewPosition | null {
  for (const [columnId, ids] of Object.entries(order)) {
    const index = ids.indexOf(taskId);
    if (index >= 0) {
      return { columnId, index };
    }
  }
  return null;
}

export function previewOrdersEqual(left: PreviewOrder, right: PreviewOrder): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => {
    const rightIds = right[key];
    const leftIds = left[key] ?? [];
    return (
      Array.isArray(rightIds) &&
      rightIds.length === leftIds.length &&
      rightIds.every((id, index) => id === leftIds[index])
    );
  });
}

export function moveTaskInPreview(
  order: Readonly<PreviewOrder>,
  activeId: string,
  overId: string,
  pointer?: PreviewPointer,
): PreviewOrder | null {
  const current = locateTaskInPreview(order, activeId);
  if (!current || overId === activeId) {
    return null;
  }

  let targetColumnId: string;
  let targetIndex: number;
  if (overId.startsWith('column:')) {
    targetColumnId = overId.slice('column:'.length);
    if (!Object.prototype.hasOwnProperty.call(order, targetColumnId)) {
      return null;
    }
    const destination = (order[targetColumnId] ?? []).filter((id) => id !== activeId);
    targetIndex = destination.length;
  } else {
    const over = locateTaskInPreview(order, overId);
    if (!over) {
      return null;
    }
    targetColumnId = over.columnId;
    const destination = (order[targetColumnId] ?? []).filter((id) => id !== activeId);
    const overIndex = destination.indexOf(overId);
    if (overIndex < 0) {
      return null;
    }
    const insertAfter = pointer
      ? pointer.activeTop > pointer.overTop + pointer.overHeight / 2
      : false;
    targetIndex = overIndex + (insertAfter ? 1 : 0);
  }

  if (targetColumnId === current.columnId && targetIndex === current.index) {
    return null;
  }

  const next: PreviewOrder = {};
  for (const [columnId, ids] of Object.entries(order)) {
    next[columnId] = ids.filter((id) => id !== activeId);
  }
  const destination = [...(next[targetColumnId] ?? [])];
  destination.splice(Math.max(0, Math.min(targetIndex, destination.length)), 0, activeId);
  next[targetColumnId] = destination;
  return next;
}

export function moveTargetFromPreview(
  order: Readonly<PreviewOrder>,
  activeId: string,
): MoveTarget | null {
  const position = locateTaskInPreview(order, activeId);
  if (!position) {
    return null;
  }
  return { toColumnId: position.columnId, targetIndex: position.index };
}
