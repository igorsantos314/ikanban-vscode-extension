import { ValidationError } from './errors';

export const PRIORITIES = ['low', 'medium', 'high'] as const;

export type Priority = (typeof PRIORITIES)[number];

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  position: number;
}

export interface Checklist {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  columnId: string;
  tags: import('./tags').TagId[];
  priority: Priority;
  position: number;
  checklists: Checklist[];
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  title: string;
  color: string;
}

export interface BoardConfig {
  version: 1;
  name: string;
  columnIds: string[];
}

export function isPriority(value: string): value is Priority {
  return PRIORITIES.includes(value as Priority);
}

export function requirePriority(value: string): Priority {
  if (!isPriority(value)) {
    throw new ValidationError(`Unsupported priority: ${value}`);
  }
  return value;
}
