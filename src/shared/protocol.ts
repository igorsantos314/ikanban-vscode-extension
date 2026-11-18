import { z } from 'zod';
import { PRIORITIES } from '../domain/types';
import { TAG_IDS } from '../domain/tags';
import type { BoardSnapshot } from './board';

const emptyPayload = z.object({}).strict();

const revisionSchema = z.string().min(1, 'A revision is required.');

const checklistItemDraftSchema = z
  .object({
    id: z.string().optional(),
    text: z.string(),
    completed: z.boolean().optional(),
  })
  .strict();

const checklistDraftSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    items: z.array(checklistItemDraftSchema).optional(),
  })
  .strict();

const taskDraftShape = {
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES),
  tags: z.array(z.enum(TAG_IDS)),
  checklists: z.array(checklistDraftSchema).optional(),
};

const boardLoad = z.object({
  type: z.literal('board/load'),
  requestId: z.string().min(1),
  payload: emptyPayload,
});

const boardInitialize = z.object({
  type: z.literal('board/initialize'),
  requestId: z.string().min(1),
  payload: emptyPayload,
});

const boardValidate = z.object({
  type: z.literal('board/validate'),
  requestId: z.string().min(1),
  payload: emptyPayload,
});

const columnCreate = z.object({
  type: z.literal('column/create'),
  requestId: z.string().min(1),
  payload: z
    .object({
      title: z.string(),
      color: z.string(),
      expectedBoardRevision: revisionSchema,
    })
    .strict(),
});

const columnUpdate = z.object({
  type: z.literal('column/update'),
  requestId: z.string().min(1),
  payload: z
    .object({
      id: z.string(),
      title: z.string(),
      color: z.string(),
      expectedRevision: revisionSchema,
    })
    .strict(),
});

const columnDelete = z.object({
  type: z.literal('column/delete'),
  requestId: z.string().min(1),
  payload: z
    .object({ id: z.string(), expectedBoardRevision: revisionSchema })
    .strict(),
});

const columnReorder = z.object({
  type: z.literal('column/reorder'),
  requestId: z.string().min(1),
  payload: z
    .object({
      columnIds: z.array(z.string()),
      expectedBoardRevision: revisionSchema,
    })
    .strict(),
});

const taskCreate = z.object({
  type: z.literal('task/create'),
  requestId: z.string().min(1),
  payload: z
    .object({
      columnId: z.string(),
      ...taskDraftShape,
    })
    .strict(),
});

const taskUpdate = z.object({
  type: z.literal('task/update'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      ...taskDraftShape,
    })
    .strict(),
});

const taskDelete = z.object({
  type: z.literal('task/delete'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
    })
    .strict(),
});

const taskMove = z.object({
  type: z.literal('task/move'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      fromColumnId: z.string(),
      toColumnId: z.string(),
      targetIndex: z.number().int().nonnegative(),
      expectedRevision: revisionSchema,
    })
    .strict(),
});

const checklistCreate = z.object({
  type: z.literal('checklist/create'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      title: z.string(),
    })
    .strict(),
});

const checklistUpdate = z.object({
  type: z.literal('checklist/update'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
      title: z.string(),
    })
    .strict(),
});

const checklistDelete = z.object({
  type: z.literal('checklist/delete'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
    })
    .strict(),
});

const checklistItemCreate = z.object({
  type: z.literal('checklistItem/create'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
      text: z.string(),
    })
    .strict(),
});

const checklistItemUpdate = z.object({
  type: z.literal('checklistItem/update'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
      itemId: z.string(),
      text: z.string().optional(),
      completed: z.boolean().optional(),
    })
    .strict(),
});

const checklistItemDelete = z.object({
  type: z.literal('checklistItem/delete'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
      itemId: z.string(),
    })
    .strict(),
});

const checklistItemToggle = z.object({
  type: z.literal('checklistItem/toggle'),
  requestId: z.string().min(1),
  payload: z
    .object({
      taskId: z.string(),
      columnId: z.string(),
      expectedRevision: revisionSchema,
      checklistId: z.string(),
      itemId: z.string(),
    })
    .strict(),
});

const fileOpen = z.object({
  type: z.literal('file/open'),
  requestId: z.string().min(1),
  payload: z
    .object({
      uri: z.string().min(1),
      range: z
        .object({
          startLine: z.number().int().nonnegative(),
          startColumn: z.number().int().nonnegative(),
          endLine: z.number().int().nonnegative(),
          endColumn: z.number().int().nonnegative(),
        })
        .strict()
        .optional(),
    })
    .strict(),
});

export const protocolRequestSchema = z.discriminatedUnion('type', [
  boardLoad,
  boardInitialize,
  boardValidate,
  columnCreate,
  columnUpdate,
  columnDelete,
  columnReorder,
  taskCreate,
  taskUpdate,
  taskDelete,
  taskMove,
  checklistCreate,
  checklistUpdate,
  checklistDelete,
  checklistItemCreate,
  checklistItemUpdate,
  checklistItemDelete,
  checklistItemToggle,
  fileOpen,
]);

export type ProtocolRequest = z.infer<typeof protocolRequestSchema>;
export type ProtocolRequestType = ProtocolRequest['type'];
export type RequestOf<T extends ProtocolRequestType> = Extract<ProtocolRequest, { type: T }>;

export const MUTATION_TYPES: ReadonlySet<ProtocolRequestType> = new Set([
  'column/create',
  'column/update',
  'column/delete',
  'column/reorder',
  'task/create',
  'task/update',
  'task/delete',
  'task/move',
  'checklist/create',
  'checklist/update',
  'checklist/delete',
  'checklistItem/create',
  'checklistItem/update',
  'checklistItem/delete',
  'checklistItem/toggle',
]);

export interface ProtocolError {
  code: string;
  message: string;
}

export type ProtocolResponse =
  | { type: 'response'; requestId: string; ok: true; data: unknown }
  | { type: 'response'; requestId: string; ok: false; error: ProtocolError };

export function createSuccessResponse(requestId: string, data: unknown): ProtocolResponse {
  return { type: 'response', requestId, ok: true, data };
}

export function createErrorResponse(
  requestId: string,
  code: string,
  message: string,
): ProtocolResponse {
  return { type: 'response', requestId, ok: false, error: { code, message } };
}

export type BoardPushMessage =
  | { type: 'board/updated'; snapshot: BoardSnapshot; version: number }
  | { type: 'board/error'; error: ProtocolError; version: number };

export type ParsedProtocolRequest =
  | { ok: true; request: ProtocolRequest }
  | { ok: false; message: string; requestId?: string };

export function parseProtocolRequest(value: unknown): ParsedProtocolRequest {
  const result = protocolRequestSchema.safeParse(value);
  if (result.success) {
    return { ok: true, request: result.data };
  }
  const requestId =
    typeof value === 'object' && value !== null && 'requestId' in value
      ? String((value as { requestId: unknown }).requestId)
      : undefined;
  return {
    ok: false,
    ...(requestId ? { requestId } : {}),
    message: result.error.issues.map((issue) => issue.message).join('; '),
  };
}
