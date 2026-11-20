import { describe, expect, it } from 'vitest';
import {
  clampPageSize,
  compareIndexEntries,
  isAfterCursor,
  selectPage,
  sortIndexEntries,
  type TaskIndexEntry,
} from './taskPagination';

function entry(id: string, position: number): TaskIndexEntry {
  return { id, position, fileName: `${id}.yaml`, size: 1, mtime: 1 };
}

describe('task pagination helpers', () => {
  const entries = [entry('b', 1024), entry('a', 1024), entry('c', 2048), entry('d', 3072)];

  it('sorts by position then task id', () => {
    expect(sortIndexEntries(entries).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('selects the first and next pages without duplicates', () => {
    const sorted = sortIndexEntries(entries);
    const first = selectPage(sorted, null, 2);
    expect(first.entries.map((item) => item.id)).toEqual(['a', 'b']);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toEqual({ position: 1024, taskId: 'b' });

    const second = selectPage(sorted, first.nextCursor, 2);
    expect(second.entries.map((item) => item.id)).toEqual(['c', 'd']);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it('uses the task id tie-breaker after the cursor', () => {
    expect(isAfterCursor(entry('b', 1024), { position: 1024, taskId: 'a' })).toBe(true);
    expect(isAfterCursor(entry('a', 1024), { position: 1024, taskId: 'a' })).toBe(false);
    expect(isAfterCursor(entry('a', 1024), { position: 2048, taskId: 'z' })).toBe(false);
  });

  it('compares positions and ids', () => {
    expect(compareIndexEntries(entry('a', 1), entry('b', 2))).toBeLessThan(0);
    expect(compareIndexEntries(entry('a', 2), entry('b', 2))).toBeLessThan(0);
    expect(compareIndexEntries(entry('b', 2), entry('a', 2))).toBeGreaterThan(0);
  });

  it('clamps page size', () => {
    expect(clampPageSize(undefined)).toBe(20);
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(500)).toBe(100);
    expect(clampPageSize(Number.NaN)).toBe(20);
  });
});
