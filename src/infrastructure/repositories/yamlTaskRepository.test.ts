import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, DuplicateEntityError, EntityNotFoundError } from '../../domain/errors';
import type { Task } from '../../domain/types';
import {
  createTestWorkspace,
  type TestWorkspace,
} from '../../test/helpers/workspace';
import { YamlBoardRepository } from './yamlBoardRepository';
import { YamlTaskRepository } from './yamlTaskRepository';

const workspaces: TestWorkspace[] = [];

afterEach(async () => {
  while (workspaces.length > 0) {
    await workspaces.pop()?.cleanup();
  }
});

async function setup(): Promise<TestWorkspace> {
  const workspace = await createTestWorkspace();
  workspaces.push(workspace);
  await workspace.board.createBoard({
    version: 1,
    name: 'Project',
    columnIds: ['backlog', 'in-progress'],
  });
  await workspace.board.createColumn({ id: 'backlog', title: 'Backlog', color: '#64748b' });
  await workspace.board.createColumn({
    id: 'in-progress',
    title: 'In Progress',
    color: '#3b82f6',
  });
  return workspace;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Task',
    description: '',
    columnId: 'backlog',
    tags: ['feat'],
    priority: 'medium',
    position: 1024,
    checklists: [],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('YamlTaskRepository', () => {
  it('creates, lists, reads, updates and deletes a task', async () => {
    const workspace = await setup();
    const task = makeTask();
    const created = await workspace.tasks.createTask(task);

    const files = await workspace.tasks.listTaskFiles('backlog');
    expect(files.map((file) => file.fileName)).toEqual([`${task.id}.yaml`]);

    const read = await workspace.tasks.readTaskById('backlog', task.id);
    expect(read?.ok && read.document.value.title).toBe('Task');
    expect(read?.ok && read.document.revision).toBe(created.revision);

    const updated = { ...task, title: 'Updated' };
    await workspace.tasks.updateTask(updated, created.revision);
    const reread = await workspace.tasks.readTaskById('backlog', task.id);
    expect(reread?.ok && reread.document.value.title).toBe('Updated');

    await workspace.tasks.deleteTask('backlog', task.id, reread?.ok ? reread.document.revision : '');
    expect(await workspace.tasks.readTaskById('backlog', task.id)).toBeUndefined();
  });

  it('rejects duplicate task files', async () => {
    const workspace = await setup();
    await workspace.tasks.createTask(makeTask());
    await expect(workspace.tasks.createTask(makeTask())).rejects.toBeInstanceOf(
      DuplicateEntityError,
    );
  });

  it('rejects updates to missing tasks', async () => {
    const workspace = await setup();
    await expect(workspace.tasks.updateTask(makeTask(), 'missing')).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });

  it('moves a task and preserves its data', async () => {
    const workspace = await setup();
    const checklistId = '650e8400-e29b-41d4-a716-446655440001';
    const task = makeTask({
      description: 'Details',
      tags: ['issue', 'spec'],
      priority: 'high',
      checklists: [
        {
          id: checklistId,
          title: 'Checklist',
          position: 1024,
          items: [
            {
              id: '750e8400-e29b-41d4-a716-446655440002',
              text: 'Done item',
              completed: true,
              position: 1024,
            },
          ],
        },
      ],
    });
    const created = await workspace.tasks.createTask(task);
    const moved = { ...task, columnId: 'in-progress', position: 1024 };
    await workspace.tasks.moveTask(moved, 'backlog', 'in-progress', created.revision);

    expect(await workspace.tasks.readTaskById('backlog', task.id)).toBeUndefined();
    const read = await workspace.tasks.readTaskById('in-progress', task.id);
    expect(read?.ok).toBe(true);
    if (read?.ok) {
      expect(read.document.value.columnId).toBe('in-progress');
      expect(read.document.value.description).toBe('Details');
      expect(read.document.value.tags).toEqual(['issue', 'spec']);
      expect(read.document.value.checklists[0]?.items[0]?.completed).toBe(true);
    }
  });

  it('does not overwrite a target task during a move', async () => {
    const workspace = await setup();
    const source = makeTask();
    const created = await workspace.tasks.createTask(source);
    await workspace.tasks.createTask(makeTask({ columnId: 'in-progress' }));

    await expect(
      workspace.tasks.moveTask(
        { ...source, columnId: 'in-progress' },
        'backlog',
        'in-progress',
        created.revision,
      ),
    ).rejects.toBeInstanceOf(DuplicateEntityError);
    expect(await workspace.tasks.readTaskById('backlog', source.id)).toBeDefined();
  });

  it('detects external edits before saving', async () => {
    const workspace = await setup();
    const task = makeTask();
    const created = await workspace.tasks.createTask(task);
    const ref = (await workspace.tasks.listTaskFiles('backlog'))[0]!;
    await workspace.fs.writeFile(
      ref.uri,
      new TextEncoder().encode(
        [
          `id: "${task.id}"`,
          'title: External',
          'description: ""',
          'tags: []',
          'priority: low',
          'position: 1024',
          'checklists: []',
          'createdAt: "2026-11-18T10:00:00.000Z"',
          'updatedAt: "2026-11-18T10:00:00.000Z"',
          '',
        ].join('\n'),
      ),
    );

    await expect(
      workspace.tasks.updateTask({ ...task, title: 'Ours' }, created.revision),
    ).rejects.toBeInstanceOf(ConflictError);

    const read = await workspace.tasks.readTaskById('backlog', task.id);
    expect(read?.ok && read.document.value.title).toBe('External');
  });

  it('reloads tasks from a new repository instance', async () => {
    const workspace = await setup();
    await workspace.tasks.createTask(makeTask());
    const freshBoard = new YamlBoardRepository(workspace.fs, workspace.store, workspace.ikanbanUri);
    const freshTasks = new YamlTaskRepository(workspace.fs, workspace.store, freshBoard);
    const read = await freshTasks.readTaskById('backlog', '550e8400-e29b-41d4-a716-446655440000');
    expect(read?.ok).toBe(true);
  });
});
