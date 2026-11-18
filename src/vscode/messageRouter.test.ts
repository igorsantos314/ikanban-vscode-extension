import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../domain/errors';
import type { BoardSnapshot } from '../shared/board';
import type { ProtocolResponse } from '../shared/protocol';
import { MessageRouter, type RouterHost, type RouterService } from './messageRouter';

function snapshot(name = 'Test'): BoardSnapshot {
  return {
    workspaceName: name,
    board: { version: 1, name, columnIds: ['backlog'], revision: 'board-rev' },
    columns: [{ id: 'backlog', title: 'Backlog', color: '#64748b', revision: 'col-rev', taskCount: 0 }],
    tasks: [],
    issues: [],
    canInitialize: false,
  };
}

function host(overrides: Partial<RouterHost> = {}): RouterHost & { posted: ProtocolResponse[] } {
  const posted: ProtocolResponse[] = [];
  return {
    posted,
    post: (message) => {
      posted.push(message);
    },
    openFile: vi.fn(async () => undefined),
    publishSnapshot: vi.fn(),
    canMutate: () => true,
    ...overrides,
  };
}

function service(overrides: Partial<RouterService> = {}): RouterService {
  return {
    loadBoard: vi.fn(async () => snapshot()),
    initializeBoard: vi.fn(async () => snapshot()),
    validateBoard: vi.fn(async () => snapshot()),
    createColumn: vi.fn(async () => snapshot()),
    updateColumn: vi.fn(async () => snapshot()),
    deleteColumn: vi.fn(async () => snapshot()),
    reorderColumns: vi.fn(async () => snapshot()),
    createTask: vi.fn(async () => ({ id: 'task' })),
    updateTask: vi.fn(async () => ({ id: 'task' })),
    deleteTask: vi.fn(async () => undefined),
    moveTask: vi.fn(async () => snapshot()),
    createChecklist: vi.fn(async () => ({ id: 'task' })),
    updateChecklist: vi.fn(async () => ({ id: 'task' })),
    deleteChecklist: vi.fn(async () => ({ id: 'task' })),
    createChecklistItem: vi.fn(async () => ({ id: 'task' })),
    updateChecklistItem: vi.fn(async () => ({ id: 'task' })),
    deleteChecklistItem: vi.fn(async () => ({ id: 'task' })),
    toggleChecklistItem: vi.fn(async () => ({ id: 'task' })),
    ...overrides,
  } as unknown as RouterService;
}

const loadRequest = {
  type: 'board/load',
  requestId: 'req-1',
  payload: {},
};

describe('MessageRouter', () => {
  it('handles a valid request and publishes the snapshot', async () => {
    const router = new MessageRouter(service(), host());
    const response = await router.handleRequest(loadRequest);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect((response.data as BoardSnapshot).workspaceName).toBe('Test');
    }
  });

  it('rejects malformed payloads with structured errors', async () => {
    const fakeHost = host();
    const router = new MessageRouter(service(), fakeHost);
    await router.handle({
      type: 'task/move',
      requestId: 'req-2',
      payload: { taskId: 'x' },
    });
    expect(fakeHost.posted[0]).toMatchObject({
      type: 'response',
      requestId: 'req-2',
      ok: false,
      error: { code: 'InvalidRequest' },
    });
  });

  it('rejects unknown message types', async () => {
    const router = new MessageRouter(service(), host());
    const response = await router.handleRequest({
      type: 'task/archive',
      requestId: 'req-3',
      payload: {},
    });
    expect(response).toMatchObject({ ok: false, error: { code: 'InvalidRequest' } });
  });

  it('prevents duplicate mutation requests from applying twice', async () => {
    let resolveLoad: ((value: BoardSnapshot) => void) | undefined;
    const loadBoard = vi.fn(
      () =>
        new Promise<BoardSnapshot>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const router = new MessageRouter(service({ loadBoard }), host());
    const first = router.handleRequest(loadRequest);
    const second = router.handleRequest(loadRequest);
    resolveLoad?.(snapshot());
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.ok).toBe(true);
    expect(secondResponse).toMatchObject({ ok: false, error: { code: 'DuplicateRequest' } });
    expect(loadBoard).toHaveBeenCalledOnce();
  });

  it('rejects mutations in an untrusted workspace', async () => {
    const fakeHost = host({ canMutate: () => false });
    const router = new MessageRouter(service(), fakeHost);
    const response = await router.handleRequest({
      type: 'task/delete',
      requestId: 'req-4',
      payload: { taskId: 'x', columnId: 'backlog', expectedRevision: 'rev' },
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'WorkspaceNotTrusted' },
    });
  });

  it('maps handler failures to structured errors without stack traces', async () => {
    const fakeHost = host();
    const router = new MessageRouter(
      service({
        updateTask: vi.fn(async () => {
          throw new ValidationError('Task title is required.');
        }),
      }),
      fakeHost,
    );
    const response = await router.handleRequest({
      type: 'task/update',
      requestId: 'req-5',
      payload: {
        taskId: 'x',
        columnId: 'backlog',
        expectedRevision: 'rev',
        title: '',
        priority: 'low',
        tags: [],
      },
    });
    expect(response).toEqual({
      type: 'response',
      requestId: 'req-5',
      ok: false,
      error: { code: 'ValidationError', message: 'Task title is required.' },
    });
  });

  it('opens files through the host', async () => {
    const openFile = vi.fn(async () => undefined);
    const router = new MessageRouter(service(), host({ openFile }));
    const response = await router.handleRequest({
      type: 'file/open',
      requestId: 'req-6',
      payload: { uri: 'file:///workspace/.ikanban/board.yaml' },
    });
    expect(response.ok).toBe(true);
    expect(openFile).toHaveBeenCalledWith('file:///workspace/.ikanban/board.yaml', undefined);
  });
});
