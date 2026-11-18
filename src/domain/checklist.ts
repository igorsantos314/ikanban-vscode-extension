import type { Checklist } from './types';

export interface ChecklistProgress {
  completed: number;
  total: number;
}

export function getChecklistProgress(checklist: Checklist): ChecklistProgress {
  const total = checklist.items.length;
  const completed = checklist.items.filter((item) => item.completed).length;
  return { completed, total };
}
