import { describe, expect, it } from 'vitest';
import { getChecklistProgress } from './checklist';
import type { Checklist } from './types';

function checklist(completed: boolean[]): Checklist {
  return {
    id: 'checklist-1',
    title: 'Checklist',
    position: 1024,
    items: completed.map((done, index) => ({
      id: `item-${index}`,
      text: `Item ${index}`,
      completed: done,
      position: (index + 1) * 1024,
    })),
  };
}

describe('checklist progress', () => {
  it('reports zero of zero for an empty checklist', () => {
    expect(getChecklistProgress(checklist([]))).toEqual({ completed: 0, total: 0 });
  });

  it('reports partial completion', () => {
    expect(getChecklistProgress(checklist([true, false, true]))).toEqual({
      completed: 2,
      total: 3,
    });
  });

  it('reports full completion', () => {
    expect(getChecklistProgress(checklist([true, true]))).toEqual({
      completed: 2,
      total: 2,
    });
  });
});
