import type { BoardConfig, Checklist, Column, Task } from '../domain/types';
import type { TagId } from '../domain/tags';
import type { ValidationIssue } from './validationIssue';

export interface TaskView extends Task {
  revision: string;
}

export interface ChecklistView extends Checklist {
  completed: number;
  total: number;
}

export interface TaskCursor {
  position: number;
  taskId: string;
}

export interface ColumnView extends Column {
  revision: string;
  taskCount: number;
  tasksRevision?: string;
  nextCursor?: TaskCursor | null;
  hasMore?: boolean;
  loadedCount?: number;
}

export interface TaskPage {
  columnId: string;
  tasks: TaskView[];
  nextCursor: TaskCursor | null;
  hasMore: boolean;
  taskCount: number;
  tasksRevision: string;
}

export interface BoardView extends BoardConfig {
  revision: string;
}

export interface BoardSnapshot {
  workspaceName: string;
  board: BoardView | null;
  columns: ColumnView[];
  tasks: TaskView[];
  issues: ValidationIssue[];
  canInitialize: boolean;
}

export interface TagDefinitionView {
  id: TagId;
  label: string;
}
