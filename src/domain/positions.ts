import { ValidationError } from './errors';

export interface Positioned {
  id: string;
  position: number;
}

export const POSITION_STEP = 1024;

export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function nextPosition(items: readonly Positioned[]): number {
  if (items.length === 0) {
    return POSITION_STEP;
  }
  return Math.max(...items.map((item) => item.position)) + POSITION_STEP;
}

export interface PositionPlan {
  positions: Record<string, number>;
  rebalanced: boolean;
}

export function planReorder(
  items: readonly Positioned[],
  movingId: string,
  targetIndex: number,
): PositionPlan {
  const sorted = sortByPosition(items);
  const moving = sorted.find((item) => item.id === movingId);
  if (!moving) {
    throw new ValidationError(`Task not found: ${movingId}.`);
  }

  const remaining = sorted.filter((item) => item.id !== movingId);
  const index = Math.max(0, Math.min(Math.trunc(targetIndex), remaining.length));
  const before = index > 0 ? remaining[index - 1] : undefined;
  const after = index < remaining.length ? remaining[index] : undefined;

  if (!before && !after) {
    return { positions: { [movingId]: POSITION_STEP }, rebalanced: false };
  }

  if (!before && after) {
    const candidate = after.position - POSITION_STEP;
    if (candidate >= 0) {
      return { positions: { [movingId]: candidate }, rebalanced: false };
    }
  }

  if (before && !after) {
    return { positions: { [movingId]: before.position + POSITION_STEP }, rebalanced: false };
  }

  if (before && after && after.position - before.position > 1) {
    return {
      positions: { [movingId]: Math.floor((before.position + after.position) / 2) },
      rebalanced: false,
    };
  }

  const reordered = [...remaining];
  reordered.splice(index, 0, moving);
  const positions: Record<string, number> = {};
  reordered.forEach((item, positionIndex) => {
    positions[item.id] = (positionIndex + 1) * POSITION_STEP;
  });
  return { positions, rebalanced: true };
}
