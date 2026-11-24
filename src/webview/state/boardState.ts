import type { BoardSnapshot, ColumnView, TaskCursor, TaskPage, TaskView } from '../../shared/board';
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

export interface ColumnPageState {
  cursor: TaskCursor | null;
  hasMore: boolean;
  tasksRevision: string;
  status: 'idle' | 'loading' | 'error' | 'end';
  error?: string;
}

export interface BoardUiState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  snapshot: BoardSnapshot | null;
  pages: Record<string, ColumnPageState>;
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
  | { type: 'page-loading'; columnId: string }
  | { type: 'page-loaded'; columnId: string; page: TaskPage }
  | { type: 'page-failed'; columnId: string; message: string }
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
  pages: {},
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
    case 'loaded': {
      const merged = mergeLoadedSnapshot(state, action.snapshot);
      return {
        ...state,
        snapshot: merged.snapshot,
        pages: merged.pages,
        status: statusFor(action.snapshot),
        busy: false,
        banner: null,
      };
    }
    case 'page-loading':
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.columnId]: {
            ...(state.pages[action.columnId] ?? {
              cursor: null,
              hasMore: false,
              tasksRevision: '',
              status: 'idle',
            }),
            status: 'loading',
            error: undefined,
          },
        },
      };
    case 'page-loaded':
      return applyPageLoaded(state, action.columnId, action.page);
    case 'page-failed': {
      const current = state.pages[action.columnId];
      if (!current) {
        return state;
      }
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.columnId]: { ...current, status: 'error', error: action.message },
        },
      };
    }
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

function pageFromSnapshot(snapshot: BoardSnapshot): Record<string, ColumnPageState> {
  const pages: Record<string, ColumnPageState> = {};
  for (const column of snapshot.columns) {
    const hasMore = column.hasMore ?? false;
    pages[column.id] = {
      cursor: column.nextCursor ?? null,
      hasMore,
      tasksRevision: column.tasksRevision ?? '',
      status: hasMore ? 'idle' : 'end',
    };
  }
  return pages;
}

function mergeLoadedSnapshot(
  state: BoardUiState,
  next: BoardSnapshot,
): { snapshot: BoardSnapshot; pages: Record<string, ColumnPageState> } {
  const previous = state.snapshot;
  if (!previous) {
    return { snapshot: next, pages: pageFromSnapshot(next) };
  }

  const tasksByColumn = new Map<string, TaskView[]>();
  for (const column of next.columns) {
    const previousPage = state.pages[column.id];
    const previousColumn = previous.columns.find((entry) => entry.id === column.id);
    const keepPrevious =
      previousPage &&
      previousColumn &&
      Boolean(column.tasksRevision) &&
      previousPage.tasksRevision === column.tasksRevision;
    const tasks = keepPrevious
      ? previous.tasks.filter((task) => task.columnId === column.id)
      : next.tasks.filter((task) => task.columnId === column.id);
    tasksByColumn.set(column.id, tasks);
  }

  const columns = next.columns.map((column) => ({
    ...column,
    loadedCount: tasksByColumn.get(column.id)?.length ?? 0,
  }));
  const tasks = sortTasks(
    { ...next, columns, tasks: [] },
    columns.flatMap((column) => tasksByColumn.get(column.id) ?? []),
  );
  const pages: Record<string, ColumnPageState> = {};
  for (const column of columns) {
    const previousPage = state.pages[column.id];
    const keepPrevious =
      previousPage &&
      Boolean(column.tasksRevision) &&
      previousPage.tasksRevision === column.tasksRevision;
    pages[column.id] = keepPrevious
      ? previousPage
      : {
          cursor: column.nextCursor ?? null,
          hasMore: column.hasMore ?? false,
          tasksRevision: column.tasksRevision ?? '',
          status: (column.hasMore ?? false) ? 'idle' : 'end',
        };
  }
  return { snapshot: { ...next, columns, tasks }, pages };
}

function applyPageLoaded(
  state: BoardUiState,
  columnId: string,
  page: TaskPage,
): BoardUiState {
  if (!state.snapshot) {
    return state;
  }
  const currentPage = state.pages[columnId];
  const column = state.snapshot.columns.find((entry) => entry.id === columnId);
  if (
    !currentPage ||
    page.columnId !== columnId ||
    (Boolean(currentPage.tasksRevision) &&
      page.tasksRevision !== currentPage.tasksRevision) ||
    (Boolean(column?.tasksRevision) && page.tasksRevision !== column?.tasksRevision)
  ) {
    return state;
  }
  const existingIds = new Set(state.snapshot.tasks.map((task) => task.id));
  const appended = page.tasks.filter((task) => !existingIds.has(task.id));
  const tasks = sortTasks(state.snapshot, [...state.snapshot.tasks, ...appended]);
  const columns = state.snapshot.columns.map((column) => {
    if (column.id !== columnId) {
      return column;
    }
    const loadedCount =
      tasks.filter((task) => task.columnId === columnId).length;
    return {
      ...column,
      taskCount: page.taskCount,
      tasksRevision: page.tasksRevision,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      loadedCount,
    };
  });
  return {
    ...state,
    snapshot: { ...state.snapshot, tasks, columns },
    pages: {
      ...state.pages,
      [columnId]: {
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        tasksRevision: page.tasksRevision,
        status: page.hasMore ? 'idle' : 'end',
      },
    },
  };
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
  const previous = snapshot.tasks.find((entry) => entry.id === task.id);
  const without = snapshot.tasks.filter((entry) => entry.id !== task.id);
  const tasks = sortTasks(snapshot, [...without, task]);
  const columns = snapshot.columns.map((column) => {
    let taskCount = column.taskCount;
    if (previous && previous.columnId !== task.columnId) {
      if (column.id === previous.columnId) {
        taskCount -= 1;
      }
      if (column.id === task.columnId) {
        taskCount += 1;
      }
    } else if (!previous && column.id === task.columnId) {
      taskCount += 1;
    }
    return {
      ...column,
      taskCount,
      ...(column.id === task.columnId
        ? { loadedCount: tasks.filter((entry) => entry.columnId === column.id).length }
        : {}),
    };
  });
  return { ...snapshot, tasks, columns };
}

function removeTask(snapshot: BoardSnapshot | null, taskId: string): BoardSnapshot | null {
  if (!snapshot) {
    return snapshot;
  }
  const removed = snapshot.tasks.find((task) => task.id === taskId);
  const tasks = snapshot.tasks.filter((task) => task.id !== taskId);
  return {
    ...snapshot,
    tasks,
    columns: snapshot.columns.map((column) =>
      column.id === removed?.columnId
        ? {
            ...column,
            taskCount: Math.max(0, column.taskCount - 1),
            loadedCount: tasks.filter((task) => task.columnId === column.id).length,
          }
        : column,
    ),
  };
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
