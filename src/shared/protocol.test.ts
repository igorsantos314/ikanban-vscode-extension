import { describe, expect, it } from 'vitest';
import {
  createErrorResponse,
  createSuccessResponse,
  MUTATION_TYPES,
  parseProtocolRequest,
  protocolRequestSchema,
} from './protocol';

const base = { requestId: 'req-1' };

describe('webview protocol', () => {
  it('parses a valid task update request', () => {
    const result = parseProtocolRequest({
      ...base,
      type: 'task/update',
      payload: {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        columnId: 'backlog',
        expectedRevision: 'abc',
        title: 'Task',
        priority: 'high',
        tags: ['feat'],
        dueAt: '2026-11-25T14:30:00.000Z',
        checklists: [
          {
            title: 'Checklist',
            items: [{ text: 'Item', completed: true }],
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.type).toBe('task/update');
    }
  });

  it('accepts null or a valid deadline and rejects a date-only deadline', () => {
    const payload = {
      ...base,
      type: 'task/update' as const,
      payload: {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        columnId: 'backlog',
        expectedRevision: 'abc',
        title: 'Task',
        priority: 'high',
        tags: [],
        dueAt: null,
      },
    };
    expect(parseProtocolRequest(payload).ok).toBe(true);
    expect(
      parseProtocolRequest({
        ...payload,
        payload: { ...payload.payload, dueAt: '2026-11-25' },
      }).ok,
    ).toBe(false);
  });

  it('rejects an unknown message type', () => {
    const result = parseProtocolRequest({
      ...base,
      type: 'task/archive',
      payload: {},
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed payload', () => {
    const result = parseProtocolRequest({
      ...base,
      type: 'task/move',
      payload: { taskId: 'x', targetIndex: 'first' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requestId).toBe('req-1');
    }
  });

  it('requires a request ID', () => {
    expect(
      protocolRequestSchema.safeParse({
        type: 'board/load',
        payload: {},
      }).success,
    ).toBe(false);
  });

  it('rejects unknown payload fields', () => {
    expect(
      protocolRequestSchema.safeParse({
        ...base,
        type: 'board/load',
        payload: { extra: true },
      }).success,
    ).toBe(false);
  });

  it('supports file open requests with a range', () => {
    expect(
      protocolRequestSchema.safeParse({
        ...base,
        type: 'file/open',
        payload: {
          uri: 'file:///workspace/.ikanban/board.yaml',
          range: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 4 },
        },
      }).success,
    ).toBe(true);
  });

  it('classifies every mutating request', () => {
    expect(MUTATION_TYPES.has('task/create')).toBe(true);
    expect(MUTATION_TYPES.has('checklistItem/toggle')).toBe(true);
    expect(MUTATION_TYPES.has('board/load')).toBe(false);
    expect(MUTATION_TYPES.has('board/validate')).toBe(false);
    expect(MUTATION_TYPES.has('file/open')).toBe(false);
  });

  it('creates success and error responses with correlated IDs', () => {
    expect(createSuccessResponse('req-1', { ok: true })).toEqual({
      type: 'response',
      requestId: 'req-1',
      ok: true,
      data: { ok: true },
    });
    expect(createErrorResponse('req-1', 'ValidationError', 'Bad')).toEqual({
      type: 'response',
      requestId: 'req-1',
      ok: false,
      error: { code: 'ValidationError', message: 'Bad' },
    });
  });
});
