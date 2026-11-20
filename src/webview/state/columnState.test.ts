import { describe, expect, it } from 'vitest';
import {
  columnOrdersEqual,
  moveColumnInPreview,
  resolveColumnTargetId,
} from './columnState';

describe('column drag state', () => {
  it('moves a column to another position', () => {
    expect(moveColumnInPreview(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(moveColumnInPreview(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('returns null for unknown, self and no-op targets', () => {
    expect(moveColumnInPreview(['a', 'b'], 'a', 'a')).toBeNull();
    expect(moveColumnInPreview(['a', 'b'], 'missing', 'b')).toBeNull();
    expect(moveColumnInPreview(['a', 'b'], 'a', 'missing')).toBeNull();
  });

  it('resolves a column droppable and a task target', () => {
    const tasks = [{ id: 'task-1', columnId: 'done' }];
    expect(resolveColumnTargetId('column:review', tasks)).toBe('review');
    expect(resolveColumnTargetId('task-1', tasks)).toBe('done');
    expect(resolveColumnTargetId('unknown', tasks)).toBeNull();
  });

  it('compares column orders', () => {
    expect(columnOrdersEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(columnOrdersEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(columnOrdersEqual(['a'], ['a', 'b'])).toBe(false);
  });
});
