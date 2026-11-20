import { createHash } from 'node:crypto';
import type { Column, BoardConfig, Task } from '../../domain/types';
import { normalizeTags } from '../../domain/tags';
import {
  boardSchema,
  columnSchema,
  taskSchema,
} from './schemas';
import { parseYaml, zodIssues } from './parser';
import { serializeBoard, serializeColumn, serializeTask, updateDocument } from './serializer';
import {
  createIssue,
  fallbackRange,
  type ValidationIssue,
} from '../../shared/validationIssue';

import type { DocumentReadResult, ParsedDocument } from '../../application/ports';

export type DocumentParseResult<T> = DocumentReadResult<T>;
export type { ParsedDocument };

export function revisionOf(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rootIssue(uri: string): ValidationIssue {
  return createIssue(
    uri,
    'schema/root',
    'Expected a YAML mapping at the document root.',
    { range: fallbackRange() },
  );
}

export function parseBoardDocument(raw: string, uri: string): DocumentParseResult<BoardConfig> {
  const parsed = parseYaml(raw, uri);
  if (!parsed.ok) {
    return parsed;
  }
  const value = parsed.parsed.value;
  if (!isRecord(value)) {
    return { ok: false, issues: [rootIssue(uri)] };
  }
  if ('version' in value && value.version !== 1) {
    return {
      ok: false,
      issues: [
        createIssue(
          uri,
          'schema/unsupported-version',
          `Unsupported schema version: ${String(value.version)}. This version of iKanban supports version 1.`,
          { path: 'version', range: fallbackRange() },
        ),
      ],
    };
  }
  const result = boardSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, issues: zodIssues(uri, result.error.issues, parsed.parsed) };
  }
  return {
    ok: true,
    document: {
      value: {
        version: 1,
        name: result.data.name,
        columnIds: result.data.columns,
      },
      revision: revisionOf(raw),
      raw,
    },
  };
}

export function parseColumnDocument(raw: string, uri: string): DocumentParseResult<Column> {
  const parsed = parseYaml(raw, uri);
  if (!parsed.ok) {
    return parsed;
  }
  const value = parsed.parsed.value;
  if (!isRecord(value)) {
    return { ok: false, issues: [rootIssue(uri)] };
  }
  const result = columnSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, issues: zodIssues(uri, result.error.issues, parsed.parsed) };
  }
  return {
    ok: true,
    document: {
      value: {
        id: result.data.id,
        title: result.data.title,
        color: result.data.color,
      },
      revision: revisionOf(raw),
      raw,
    },
  };
}

export function parseTaskDocument(
  raw: string,
  uri: string,
  columnId: string,
): DocumentParseResult<Task> {
  const parsed = parseYaml(raw, uri);
  if (!parsed.ok) {
    return parsed;
  }
  const value = parsed.parsed.value;
  if (!isRecord(value)) {
    return { ok: false, issues: [rootIssue(uri)] };
  }
  const result = taskSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, issues: zodIssues(uri, result.error.issues, parsed.parsed) };
  }
  return {
    ok: true,
    document: {
      value: {
        id: result.data.id,
        title: result.data.title,
        description: result.data.description ?? '',
        columnId,
        tags: normalizeTags(result.data.tags),
        priority: result.data.priority,
        position: result.data.position,
        checklists: result.data.checklists.map((checklist) => ({
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
        ...(result.data.dueAt ? { dueAt: result.data.dueAt } : {}),
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      },
      revision: revisionOf(raw),
      raw,
    },
  };
}

export type SerializedDocument = { content: string };

export function serializeBoardDocument(board: BoardConfig, existingRaw?: string): string {
  if (existingRaw) {
    return updateDocument(
      existingRaw,
      {
        version: board.version,
        name: board.name,
        columns: [...board.columnIds],
      },
      'board.yaml',
    );
  }
  return serializeBoard(board);
}

export function serializeColumnDocument(column: Column, existingRaw?: string): string {
  if (existingRaw) {
    return updateDocument(
      existingRaw,
      { id: column.id, title: column.title, color: column.color },
      'column.yaml',
    );
  }
  return serializeColumn(column);
}

export function serializeTaskDocument(task: Task, existingRaw?: string): string {
  if (existingRaw) {
    return updateDocument(existingRaw, toTaskUpdates(task), 'task.yaml');
  }
  return serializeTask(task);
}

function toTaskUpdates(task: Task): Record<string, unknown> {
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
    dueAt: task.dueAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
