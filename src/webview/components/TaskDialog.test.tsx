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

describe('TaskDialog', () => {
  it('validates the required title before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(screen.getByText('Task title is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute(
      'aria-describedby',
      'task-title-error',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('creates a task with tags, checklists and items', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_payload: TaskDialogPayload) => undefined);
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Title'), 'New task');
    await user.type(screen.getByLabelText('Description'), 'A description');
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.click(screen.getByRole('button', { name: /feature/i }));
    await user.click(screen.getByRole('button', { name: /spec/i }));

    await user.click(screen.getByRole('button', { name: '+ Add checklist' }));
    await user.type(screen.getByLabelText('Checklist 1 title'), 'Implementation');
    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    await user.type(screen.getByLabelText('Checklist 1 item 1 text'), 'First item');
    await user.click(screen.getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const payload = onSave.mock.calls[0]![0];
    expect(payload).toMatchObject({
      columnId: 'backlog',
      title: 'New task',
      description: 'A description',
      priority: 'high',
      tags: ['feat', 'spec'],
    });
    expect(payload.checklists[0]).toMatchObject({
      title: 'Implementation',
      items: [{ text: 'First item', completed: true }],
    });
  });

  it('loads an existing task for editing', () => {
    render(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Existing task');
    expect(screen.getByLabelText('Description')).toHaveValue('Existing description');
    expect(screen.getByLabelText('Column')).toHaveValue('backlog');
    expect(screen.getByLabelText('Priority')).toHaveValue('high');
    expect(screen.getByRole('button', { name: /feature/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByDisplayValue('Implementation')).toBeInTheDocument();
    expect(screen.getByDisplayValue('First item')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('shows read-only creation and last-updated timestamps when editing', () => {
    render(
      <TaskDialog
        task={{ ...existingTask, updatedAt: '2026-11-19T12:30:00.000Z' }}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    const metadata = screen.getByLabelText('Task timestamps');
    expect(metadata.textContent).toContain('Created');
    expect(metadata.textContent).toContain('Last updated');
    expect(
      metadata.querySelector('time[datetime="2026-11-18T10:00:00.000Z"]'),
    ).not.toBeNull();
    expect(
      metadata.querySelector('time[datetime="2026-11-19T12:30:00.000Z"]'),
    ).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: /created/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /last updated/i })).not.toBeInTheDocument();
  });

  it('hides timestamps when creating a task', () => {
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.queryByLabelText('Task timestamps')).not.toBeInTheDocument();
  });

  it('prevents duplicate submissions while saving', async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );
    await user.type(screen.getByLabelText('Title'), 'Slow task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await user.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(onSave).toHaveBeenCalledOnce();
    resolveSave?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled());
  });

  it('keeps the dialog and entered data when saving fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {
      throw new Error('This task was modified outside iKanban. Reload before saving.');
    });
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );
    await user.type(screen.getByLabelText('Title'), 'Failing task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(
      await screen.findByText('This task was modified outside iKanban. Reload before saving.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Failing task');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeInTheDocument();
  });

  it('confirms before discarding unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={vi.fn()} onClose={onClose} />,
    );
    await user.type(screen.getByLabelText('Title'), 'Dirty');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Dirty');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an empty checklist state and supports deleting checklists', async () => {
    const user = userEvent.setup();
    render(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /delete checklist implementation/i }));
    expect(screen.queryByDisplayValue('Implementation')).not.toBeInTheDocument();
  });

  it('loads the persisted deadline in local masked fields', () => {
    const parts = splitDueAt(existingTask.dueAt!);
    render(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Deadline date')).toHaveValue(parts?.date);
    expect(screen.getByLabelText('Deadline time')).toHaveValue(parts?.time);
  });

  it('saves a deadline entered with the mask', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_payload: TaskDialogPayload) => undefined);
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );
    await user.type(screen.getByLabelText('Title'), 'Deadline task');
    await user.type(screen.getByLabelText('Deadline date'), '251120261430');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]![0].dueAt).toBe(
      joinLocalDeadline('25/11/2026', '14:30'),
    );
  });

  it('rejects a partial or impossible deadline', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <TaskDialog columns={columns} initialColumnId="backlog" onSave={onSave} onClose={vi.fn()} />,
    );
    await user.type(screen.getByLabelText('Title'), 'Deadline task');
    await user.type(screen.getByLabelText('Deadline date'), '25112026');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(screen.getByText('Fill in both the deadline date and time.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Deadline time'), '1430');
    await user.clear(screen.getByLabelText('Deadline date'));
    await user.type(screen.getByLabelText('Deadline date'), '31022026');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid calendar date and time.')).toBeInTheDocument();
  });

  it('clears an existing deadline and sends null', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_payload: TaskDialogPayload) => undefined);
    render(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear deadline' }));
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]![0].dueAt).toBeNull();
  });

  it('shows Delete task only for existing tasks and reports it', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const { rerender } = render(
      <TaskDialog
        columns={columns}
        initialColumnId="backlog"
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Delete task' })).not.toBeInTheDocument();

    rerender(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete task' }));
    expect(onDelete).toHaveBeenCalledWith(existingTask);
  });

  it('marks Save and Cancel with distinct classes and icons', () => {
    const { container } = render(
      <TaskDialog
        task={existingTask}
        columns={columns}
        onSave={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save task' })).toHaveClass(
      'btn-primary',
      'btn-save',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('btn-cancel');
    expect(container.querySelectorAll('.modal-footer svg').length).toBeGreaterThanOrEqual(2);
  });
});
