import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnView, TaskView } from '../../shared/board';
import { joinLocalDeadline, splitDueAt } from '../../domain/deadline';
import { TaskDialog, type TaskDialogPayload } from './TaskDialog';

const columns: ColumnView[] = [
  { id: 'backlog', title: 'Backlog', color: '#64748b', revision: 'rev-a', taskCount: 0 },
  { id: 'done', title: 'Done', color: '#22c55e', revision: 'rev-b', taskCount: 0 },
];

const existingTask: TaskView = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Existing task',
  description: 'Existing description',
  columnId: 'backlog',
  tags: ['feat'],
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
          text: 'First item',
          completed: true,
          position: 1024,
        },
      ],
    },
  ],
  dueAt: '2026-11-25T14:30:00.000Z',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  revision: 'task-rev',
};

function savedFromPayload(
  payload: TaskDialogPayload,
  current: { id: string; revision: string } | null,
): TaskView {
  return {
    ...existingTask,
    id: current?.id ?? '550e8400-e29b-41d4-a716-446655440099',
    title: payload.title,
    description: payload.description,
    columnId: payload.columnId,
    tags: payload.tags,
    priority: payload.priority,
    checklists: payload.checklists.map((checklist, index) => ({
      id: checklist.id ?? `${index}`,
      title: checklist.title,
      position: index * 1024,
      items: checklist.items.map((item, itemIndex) => ({
        id: item.id ?? `${index}-${itemIndex}`,
        text: item.text,
        completed: item.completed ?? false,
        position: itemIndex * 1024,
      })),
    })),
    dueAt: payload.dueAt ?? undefined,
    revision: current ? `${current.revision}-next` : 'created-rev',
  };
}

function renderDialog({
  task,
  onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
    savedFromPayload(payload, current),
  ),
  onReload = vi.fn(async () => existingTask),
  onClose = vi.fn(),
  onDelete,
  inert,
}: {
  task?: TaskView;
  onAutosave?: (payload: TaskDialogPayload, current: { id: string; revision: string } | null) => Promise<TaskView>;
  onReload?: (taskId: string) => Promise<TaskView>;
  onClose?: () => void;
  onDelete?: (task: TaskView) => void;
  inert?: boolean;
} = {}) {
  return render(
    <TaskDialog
      task={task}
      columns={columns}
      initialColumnId="backlog"
      onAutosave={onAutosave}
      onReload={onReload}
      onClose={onClose}
      onDelete={onDelete}
      inert={inert}
    />,
  );
}

async function waitForAutosave(onAutosave: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onAutosave).toHaveBeenCalled(), { timeout: 1500 });
}

describe('TaskDialog autosave', () => {
  it('shows the automatic save label and only Delete/Voltar actions', () => {
    renderDialog({ task: existingTask, onDelete: vi.fn() });
    expect(screen.getByRole('status')).toHaveTextContent(/saved automatically/i);
    expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('starts existing text fields read-only and enables on click', async () => {
    const user = userEvent.setup();
    renderDialog({ task: existingTask });
    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('readonly');
    await user.click(title);
    expect(title).not.toHaveAttribute('readonly');
  });

  it('autosaves title edits after the debounce', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    renderDialog({ task: existingTask, onAutosave });

    const title = screen.getByLabelText('Title');
    await user.click(title);
    await user.clear(title);
    await user.type(title, 'Updated title');

    await waitForAutosave(onAutosave);
    expect(onAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated title' }),
      { id: existingTask.id, revision: existingTask.revision },
    );
  });

  it('auto-creates a task from the first valid draft and then updates it', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    renderDialog({ onAutosave });

    await user.type(screen.getByLabelText('Title'), 'New task');
    await waitForAutosave(onAutosave);
    expect(onAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task' }),
      null,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Saved'),
    );

    await user.selectOptions(screen.getByLabelText('Priority'), 'low');
    await waitFor(() =>
      expect(onAutosave).toHaveBeenCalledTimes(2),
    );
    expect(onAutosave.mock.calls[1]![1]).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440099',
    });
  });

  it('does not create a task for an invalid draft and Voltar closes without a file', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    const onClose = vi.fn();
    renderDialog({ onAutosave, onClose });

    await user.type(screen.getByLabelText('Deadline date'), '25112026');
    await waitFor(() =>
      expect(screen.getByText('Fill in both the deadline date and time.')).toBeInTheDocument(),
      { timeout: 1500 },
    );
    await user.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAutosave).not.toHaveBeenCalled();
  });

  it('flushes a pending autosave when Voltar is activated', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    const onClose = vi.fn();
    renderDialog({ task: existingTask, onAutosave, onClose });

    const title = screen.getByLabelText('Title');
    await user.click(title);
    await user.type(title, ' flush');
    await user.click(screen.getByRole('button', { name: /voltar/i }));

    await waitFor(() => expect(onAutosave).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps the local draft and offers Reload on conflict', async () => {
    const user = userEvent.setup();
    const reloaded = { ...existingTask, title: 'External title', revision: 'external' };
    const onAutosave = vi.fn(async () => {
      throw Object.assign(new Error('This task was modified outside iKanban.'), {
        code: 'ConflictError',
      });
    });
    const onReload = vi.fn(async () => reloaded);
    renderDialog({ task: existingTask, onAutosave, onReload });

    const title = screen.getByLabelText('Title');
    await user.click(title);
    await user.type(title, ' local');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument());
    expect(title).toHaveValue('Existing task local');

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('External title'));
  });

  it('rejects partial deadlines without autosaving', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    renderDialog({ task: existingTask, onAutosave });

    await user.click(screen.getByLabelText('Deadline date'));
    await user.clear(screen.getByLabelText('Deadline time'));
    await waitFor(() =>
      expect(screen.getByText('Fill in both the deadline date and time.')).toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(onAutosave).not.toHaveBeenCalled();
  });

  it('shows Delete only for existing tasks', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const first = renderDialog({ onDelete });
    expect(screen.queryByRole('button', { name: 'Delete task' })).not.toBeInTheDocument();
    first.unmount();

    renderDialog({ task: existingTask, onDelete });
    await user.click(screen.getByRole('button', { name: 'Delete task' }));
    expect(onDelete).toHaveBeenCalledWith(existingTask);
  });

  it('loads the persisted deadline and checklist values', () => {
    const parts = splitDueAt(existingTask.dueAt!);
    renderDialog({ task: existingTask });
    expect(screen.getByLabelText('Deadline date')).toHaveValue(parts?.date);
    expect(screen.getByLabelText('Deadline time')).toHaveValue(parts?.time);
    expect(screen.getByDisplayValue('Implementation')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('First item')).toHaveAttribute('readonly');
  });

  it('marks new checklist fields editable immediately', async () => {
    const user = userEvent.setup();
    renderDialog({ task: existingTask });
    await user.click(screen.getByRole('button', { name: '+ Add checklist' }));
    const title = screen.getByLabelText('Checklist 2 title');
    expect(title).not.toHaveAttribute('readonly');
  });

  it('clears an existing deadline by autosave', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    renderDialog({ task: existingTask, onAutosave });

    await user.click(screen.getByRole('button', { name: 'Clear deadline' }));
    await waitFor(() =>
      expect(onAutosave).toHaveBeenCalledWith(
        expect.objectContaining({ dueAt: null }),
        expect.anything(),
      ),
    );
  });

  it('coalesces rapid edits while a save is in flight', async () => {
    const user = userEvent.setup();
    const resolvers: Array<() => void> = [];
    const onAutosave = vi.fn(
      (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
        new Promise<TaskView>((resolve) => {
          resolvers.push(() => resolve(savedFromPayload(payload, current)));
        }),
    );
    renderDialog({ onAutosave });

    await user.type(screen.getByLabelText('Title'), 'First');
    await waitForAutosave(onAutosave);

    await user.type(screen.getByLabelText('Title'), ' more');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onAutosave).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(2));
    expect(onAutosave.mock.calls[1]![0].title).toBe('First more');
  });

  it('exposes the local deadline conversion when saving', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    renderDialog({ onAutosave });

    await user.type(screen.getByLabelText('Title'), 'Deadline task');
    await user.type(screen.getByLabelText('Deadline date'), '251120261430');
    await waitForAutosave(onAutosave);
    expect(onAutosave).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt: joinLocalDeadline('25/11/2026', '14:30'),
      }),
      null,
    );
  });
});

describe('TaskDialog close without changes', () => {
  it('closes without autosaving when nothing changed', async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn(async (payload: TaskDialogPayload, current: { id: string; revision: string } | null) =>
      savedFromPayload(payload, current),
    );
    const onClose = vi.fn();
    renderDialog({ task: existingTask, onAutosave, onClose });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onAutosave).not.toHaveBeenCalled();
  });
});
