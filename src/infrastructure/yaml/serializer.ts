import { Document, parseDocument } from 'yaml';
import { ValidationError } from '../../domain/errors';
import type { Column, Task } from '../../domain/types';

export function stringifyYaml(value: unknown): string {
  const document = new Document(value);
  return document.toString({ lineWidth: 0, minContentWidth: 0 });
}

export function toPersistedTask(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    tags: task.tags,
    priority: task.priority,
    position: task.position,
    checklists: task.checklists.map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      position: checklist.position,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
        position: item.position,
      })),
    })),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function serializeTask(task: Task): string {
  return stringifyYaml(toPersistedTask(task));
}

export function serializeBoard(board: {
  version: 1;
  name: string;
  columnIds: readonly string[];
}): string {
  return stringifyYaml({
    version: board.version,
    name: board.name,
    columns: [...board.columnIds],
  });
}

export function serializeColumn(column: Column): string {
  return stringifyYaml({
    id: column.id,
    title: column.title,
    color: column.color,
  });
}

export function updateDocument(
  raw: string,
  updates: Record<string, unknown>,
  uri: string,
): string {
  const document = parseDocument(raw, {
    uniqueKeys: true,
    strict: true,
    prettyErrors: false,
  });

  if (document.errors.length > 0) {
    throw new ValidationError(
      'Cannot update a file with invalid YAML syntax.',
      document.errors.map((error) => `${uri}: ${error.message}`).join('\n'),
    );
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      document.delete(key);
    } else {
      document.set(key, value);
    }
  }

  return document.toString({ lineWidth: 0, minContentWidth: 0 });
}
