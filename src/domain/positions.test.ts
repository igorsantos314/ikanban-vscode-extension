import { describe, expect, it } from 'vitest';
import { nextPosition, planReorder, POSITION_STEP, sortByPosition } from './positions';
import { ValidationError } from './errors';

const tasks = [
  { id: 'b', position: 2048 },
  { id: 'a', position: 1024 },
  { id: 'c', position: 3072 },
];

describe('positions', () => {
  it('sorts by position and then id for deterministic ties', () => {
    expect(
      sortByPosition([
        { id: 'z', position: 1024 },
        { id: 'a', position: 1024 },
        { id: 'm', position: 512 },
      ]).map((item) => item.id),
    ).toEqual(['m', 'a', 'z']);
  });

  it('appends new items using spaced positions', () => {
    expect(nextPosition([])).toBe(POSITION_STEP);
    expect(nextPosition(tasks)).toBe(4096);
  });

  it('inserts between neighbors with a midpoint', () => {
    const plan = planReorder(tasks, 'c', 1);
    expect(plan.rebalanced).toBe(false);
    expect(plan.positions).toEqual({ c: 1536 });
  });

  it('moves to the beginning and end', () => {
    expect(planReorder(tasks, 'c', 0).positions).toEqual({ c: 0 });
    expect(planReorder(tasks, 'a', 3).positions).toEqual({ a: 4096 });
  });

  it('rebalances the whole parent when no gap remains', () => {
    const tight = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ];
    const plan = planReorder(tight, 'c', 1);
    expect(plan.rebalanced).toBe(true);
    expect(plan.positions).toEqual({ a: 1024, c: 2048, b: 3072 });
  });

  it('clamps the target index to the available range', () => {
    expect(planReorder(tasks, 'a', -10).positions).toEqual({ a: 1024 });
    expect(planReorder(tasks, 'a', 99).positions).toEqual({ a: 4096 });
  });

  it('rejects an unknown moving item', () => {
    expect(() => planReorder(tasks, 'missing', 0)).toThrow(ValidationError);
  });
});
