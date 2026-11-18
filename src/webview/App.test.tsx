import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BoardSnapshot, TaskView } from '../shared/board';
import type { BoardClientLike } from './api/boardClient';
import type { BoardPushMessage, ProtocolRequestType } from '../shared/protocol';
import { App } from './App';

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Fix login',
    description: 'Login fails on refresh',
    columnId: 'backlog',
    tags: ['issue', 'feat'],
    priority: 'high',
    position: 1024,
    checklists: [
      {
        id: '650e8400-e29b-41d4-a716-446655440001',
        title: 'Implementation',
        position: 1024,
        items: [
          {
            id: '750e8400-e29b-41d4-a716-446655440002',
            text: 'Done',
            completed: true,
            position: 1024,
          },
          {
            id: '750e8400-e29b-41d4-a716-446655440003',
            text: 'Todo',
            completed: false,
            position: 2048,
          },
        ],
      },
    ],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    revision: 'task-1-rev',
    ...overrides,
  };
}

function snapshot(tasks: TaskView[] = []): BoardSnapshot {
  return {
    workspaceName: 'Workspace',
    board: { version: 1, name: 'My Project', columnIds: ['backlog', 'done'], revision: 'board-rev' },
    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        color: '#64748b',
        revision: 'col-a',
        taskCount: tasks.filter((entry) => entry.columnId === 'backlog').length,
      },
      {
        id: 'done',
        title: 'Done',
        color: '#22c55e',
        revision: 'col-b',
        taskCount: tasks.filter((entry) => entry.columnId === 'done').length,
      },
    ],
    tasks,
    issues: [],
    canInitialize: false,
  };
}

interface FakeOptions {
  load?: BoardSnapshot;
  onRequest?: (type: ProtocolRequestType, payload: unknown) => unknown;
}

function fakeClient(options: FakeOptions = {}) {
  let listener: ((message: BoardPushMessage) => void) | undefined;
  const request = vi.fn(async (type: ProtocolRequestType, payload: unknown) => {
    if (options.onRequest) {
      const result = options.onRequest(type, payload);
      if (result !== undefined) {
        return result;
      }
    }
    if (type === 'board/load') {
      return options.load ?? snapshot();
    }
    throw new Error(`Unhandled request: ${type}`);
  });
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((next: (message: BoardPushMessage) => void) => {
    listener = next;
    return unsubscribe;
  });
  const client: BoardClientLike = {
    request: request as BoardClientLike['request'],
    subscribe,
    dispose: vi.fn(),
  };
  return {
    client,
    request,
    push: (message: BoardPushMessage) => listener?.(message),
    unsubscribe,
  };
}

describe('App', () => {
  it('shows a loading state before the board arrives', async () => {
    let resolveLoad: ((value: BoardSnapshot) => void) | undefined;
    const client: BoardClientLike = {
      request: vi.fn(
        () =>
          new Promise<BoardSnapshot>((resolve) => {
            resolveLoad = resolve;
          }),
      ) as BoardClientLike['request'],
      subscribe: vi.fn(() => () => undefined),
      dispose: vi.fn(),
    };
    render(<App client={client} />);
    expect(screen.getByText('Loading iKanban board…')).toBeInTheDocument();
    resolveLoad?.(snapshot());
    await screen.findByText('My Project');
  });

  it('renders board metadata, tags, priority and checklist progress', async () => {
    const fixes = task();
    const spec = task({
      id: '550e8400-e29b-41d4-a716-446655440010',
      title: 'Write spec',
      description: '',
      columnId: 'done',
      tags: ['spec'],
      priority: 'low',
      checklists: [],
      revision: 'task-2-rev',
    });
    const { client } = fakeClient({ load: snapshot([fixes, spec]) });
    render(<App client={client} />);

    await screen.findByText('My Project');
    expect(screen.getByText('Workspace · 2 columns · 2 tasks')).toBeInTheDocument();
    expect(screen.getByText('Fix login')).toBeInTheDocument();
    expect(screen.getByText('Login fails on refresh')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getAllByText('Issue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Feature').length).toBeGreaterThan(0);
    expect(screen.getByText('Checklist 1/2')).toBeInTheDocument();
    expect(screen.getAllByLabelText('1 task')).toHaveLength(2);
    expect(
      document.querySelectorAll('time[datetime="2026-11-18T10:00:00.000Z"]'),
    ).toHaveLength(2);
  });

  it('initializes an empty workspace', async () => {
    const user = userEvent.setup();
    const empty: BoardSnapshot = {
      workspaceName: 'Workspace',
      board: null,
      columns: [],
      tasks: [],
      issues: [],
      canInitialize: true,
    };
    const { client, request } = fakeClient({
      load: empty,
      onRequest: (type) => (type === 'board/initialize' ? snapshot() : undefined),
    });
    render(<App client={client} />);
    await screen.findByText('No iKanban board yet');
    await user.click(screen.getByRole('button', { name: 'Initialize board' }));
    await screen.findByText('My Project');
    expect(request).toHaveBeenCalledWith('board/initialize', {});
  });

  it('creates a task through the dialog and shows it on the board', async () => {
    const user = userEvent.setup();
    const created = task({
      id: '550e8400-e29b-41d4-a716-446655440020',
      title: 'New task',
      description: 'New description',
      tags: ['chore'],
      priority: 'medium',
      checklists: [],
      revision: 'new-rev',
    });
    const { client, request } = fakeClient({
      load: snapshot(),
      onRequest: (type) => (type === 'task/create' ? created : undefined),
    });
    render(<App client={client} />);
    await screen.findByText('My Project');

    await user.click(screen.getByRole('button', { name: 'Add task to Backlog' }));
    await user.type(screen.getByLabelText('Title'), 'New task');
    await user.type(screen.getByLabelText('Description'), 'New description');
    await user.click(screen.getByRole('button', { name: /chore/i }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByText('New task');
    expect(request).toHaveBeenCalledWith(
      'task/create',
      expect.objectContaining({
        columnId: 'backlog',
        title: 'New task',
        tags: ['chore'],
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a task after confirmation', async () => {
    const user = userEvent.setup();
    const item = task();
    const { client, request } = fakeClient({
      load: snapshot([item]),
      onRequest: (type) => (type === 'task/delete' ? { taskId: item.id } : undefined),
    });
    render(<App client={client} />);
    await screen.findByText('Fix login');

    await user.click(screen.getByRole('button', { name: 'Delete task Fix login' }));
    expect(screen.getByText(/Delete “Fix login”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Fix login')).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledWith('task/delete', {
      taskId: item.id,
      columnId: 'backlog',
      expectedRevision: 'task-1-rev',
    });
  });

  it('keeps a task when deletion is cancelled', async () => {
    const user = userEvent.setup();
    const item = task();
    const { client } = fakeClient({ load: snapshot([item]) });
    render(<App client={client} />);
    await screen.findByText('Fix login');
    await user.click(screen.getByRole('button', { name: 'Delete task Fix login' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Fix login')).toBeInTheDocument();
  });

  it('renders long unbroken titles without breaking the column layout', async () => {
    const longTitle = 'x'.repeat(240);
    const { client } = fakeClient({ load: snapshot([task({ title: longTitle })]) });
    render(<App client={client} />);
    await screen.findByText(longTitle);
    expect(screen.getByText(longTitle)).toHaveClass('task-card-title');
  });

  it('shows a retry state when the board cannot be loaded', async () => {
    const { client, request } = fakeClient({
      onRequest: (type) => {
        if (type === 'board/load') {
          throw new Error('The board could not be read.');
        }
        return undefined;
      },
    });
    render(<App client={client} />);
    expect(await screen.findByText('The board could not be loaded')).toBeInTheDocument();
    const calls = request.mock.calls.length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(request.mock.calls.length).toBeGreaterThan(calls));
  });

  it('creates a column with the current board revision', async () => {
    const user = userEvent.setup();
    const withReview = snapshot();
    withReview.columns.push({
      id: 'review',
      title: 'Review',
      color: '#8b5cf6',
      revision: 'col-c',
      taskCount: 0,
    });
    withReview.board!.columnIds.push('review');
    const { client, request } = fakeClient({
      load: snapshot(),
      onRequest: (type) => (type === 'column/create' ? withReview : undefined),
    });
    render(<App client={client} />);
    await screen.findByText('My Project');

    await user.click(screen.getByRole('button', { name: '+ Add column' }));
    await user.type(screen.getByLabelText('Title'), 'Review');
    await user.click(screen.getByRole('button', { name: 'Save column' }));
    await screen.findByText('Review');
    expect(request).toHaveBeenCalledWith(
      'column/create',
      expect.objectContaining({ title: 'Review', expectedBoardRevision: 'board-rev' }),
    );
  });

  it('reorders columns through the board revision', async () => {
    const user = userEvent.setup();
    const { client, request } = fakeClient({ load: snapshot() });
    render(<App client={client} />);
    await screen.findByText('My Project');
    await user.click(screen.getByRole('button', { name: 'Move Backlog column right' }));
    expect(request).toHaveBeenCalledWith('column/reorder', {
      columnIds: ['done', 'backlog'],
      expectedBoardRevision: 'board-rev',
    });
  });

  it('rejects deleting a populated column with an error banner', async () => {
    const user = userEvent.setup();
    const { client } = fakeClient({
      load: snapshot([task()]),
      onRequest: (type) => {
        if (type === 'column/delete') {
          throw new Error('This column cannot be deleted while it contains tasks.');
        }
        return undefined;
      },
    });
    render(<App client={client} />);
    await screen.findByText('Fix login');
    await user.click(screen.getByRole('button', { name: 'Delete Backlog column' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText('This column cannot be deleted while it contains tasks.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fix login')).toBeInTheDocument();
  });

  it('provides a keyboard-accessible way to move a task between columns', async () => {
    const user = userEvent.setup();
    const item = task();
    const moved = { ...item, columnId: 'done', revision: 'moved-rev' };
    const after = snapshot([moved]);
    const { client, request } = fakeClient({
      load: snapshot([item]),
      onRequest: (type) => (type === 'task/move' ? after : undefined),
    });
    render(<App client={client} />);
    await screen.findByText('Fix login');
    await user.click(screen.getByRole('button', { name: 'Move Fix login to the next column' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'task/move',
        expect.objectContaining({ toColumnId: 'done', targetIndex: 0 }),
      ),
    );
  });

  it('opens validation issues and asks the host to open the file', async () => {
    const user = userEvent.setup();
    const loaded = snapshot();
    loaded.issues = [
      {
        uri: 'file:///workspace/.ikanban/board.yaml',
        severity: 'error',
        code: 'schema/invalid',
        message: 'Board name is required.',
        range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 5 },
      },
    ];
    const { client, request } = fakeClient({ load: loaded });
    render(<App client={client} />);
    await screen.findByText('My Project');
    expect(screen.getByRole('button', { name: /validation status: 1 issues/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /validation status/i }));
    expect(screen.getByText('Board name is required.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open file:\/\/\/workspace/i }));
    expect(request).toHaveBeenCalledWith('file/open', {
      uri: 'file:///workspace/.ikanban/board.yaml',
      range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 5 },
    });
  });

  it('applies watcher push updates', async () => {
    const { client, push } = fakeClient({ load: snapshot() });
    render(<App client={client} />);
    await screen.findByText('My Project');
    push({ type: 'board/updated', snapshot: snapshot([task()]), version: 2 });
    await screen.findByText('Fix login');
    expect(screen.getByText('Fix login')).toBeInTheDocument();
  });
});
