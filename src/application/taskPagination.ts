import type { TaskCursor } from '../shared/board';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface TaskIndexEntry {
  id: string;
  position: number;
  fileName: string;
  size: number;
  mtime: number;
}

export interface IndexedFileMetadata {
  fileName: string;
  size: number;
  mtime: number;
}

export interface ColumnTaskIndex {
  version: 1;
  columnId: string;
  tasksRevision: string;
  sourceFiles: IndexedFileMetadata[];
  entries: TaskIndexEntry[];
}

export function compareIndexEntries(
  left: Pick<TaskIndexEntry, 'id' | 'position'>,
  right: Pick<TaskIndexEntry, 'id' | 'position'>,
): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  return left.id.localeCompare(right.id);
}

export function sortIndexEntries(entries: readonly TaskIndexEntry[]): TaskIndexEntry[] {
  return [...entries].sort(compareIndexEntries);
}

export function isAfterCursor(
  entry: Pick<TaskIndexEntry, 'id' | 'position'>,
  cursor: TaskCursor,
): boolean {
  return (
    entry.position > cursor.position ||
    (entry.position === cursor.position && entry.id > cursor.taskId)
  );
}

export function selectPage(
  entries: readonly TaskIndexEntry[],
  cursor: TaskCursor | null,
  limit: number = DEFAULT_PAGE_SIZE,
): {
  entries: TaskIndexEntry[];
  nextCursor: TaskCursor | null;
  hasMore: boolean;
} {
  const pageSize = Math.max(1, Math.min(Math.trunc(limit), MAX_PAGE_SIZE));
  const remaining = cursor ? entries.filter((entry) => isAfterCursor(entry, cursor)) : [...entries];
  const page = remaining.slice(0, pageSize);
  const hasMore = remaining.length > page.length;
  const last = page[page.length - 1];
  return {
    entries: page,
    nextCursor: hasMore && last ? { position: last.position, taskId: last.id } : null,
    hasMore,
  };
}

export function cursorForEntry(entry: Pick<TaskIndexEntry, 'id' | 'position'>): TaskCursor {
  return { position: entry.position, taskId: entry.id };
}

export function clampPageSize(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(Math.trunc(limit), MAX_PAGE_SIZE));
}
