import { describe, expect, it } from 'vitest';
import { boardSchema, columnSchema, taskSchema } from './schemas';

import { validTask } from '../../test/helpers/taskFixtures';

describe('board schema', () => {
  it('accepts a valid board', () => {
    const result = boardSchema.safeParse({
      version: 1,
      name: 'My Project',
      columns: ['backlog', 'in-progress', 'done'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = boardSchema.safeParse({ version: 1, columns: ['backlog'] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate column references', () => {
    const result = boardSchema.safeParse({
      version: 1,
      name: 'My Project',
      columns: ['backlog', 'backlog'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty column list', () => {
    const result = boardSchema.safeParse({ version: 1, name: 'My Project', columns: [] });
    expect(result.success).toBe(false);
  });
});

describe('column schema', () => {
  it('accepts a valid column', () => {
    expect(
      columnSchema.safeParse({ id: 'in-progress', title: 'In Progress', color: '#3b82f6' })
        .success,
    ).toBe(true);
  });

  it('rejects an unsafe identifier', () => {
    expect(
      columnSchema.safeParse({ id: '../outside', title: 'Outside', color: '#000000' }).success,
    ).toBe(false);
  });

  it('rejects an invalid color', () => {
    expect(
      columnSchema.safeParse({ id: 'review', title: 'Review', color: 'red' }).success,
    ).toBe(false);
  });

  it('rejects a blank title', () => {
    expect(
      columnSchema.safeParse({ id: 'review', title: '   ', color: '#000000' }).success,
    ).toBe(false);
  });
});

describe('task schema', () => {
  it('accepts a valid task and allows unknown top-level fields', () => {
    const result = taskSchema.safeParse({ ...validTask, custom: 'kept' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom).toBe('kept');
    }
  });

  it('accepts an empty description, no tags and no checklists', () => {
    expect(
      taskSchema.safeParse({
        ...validTask,
        description: '',
        tags: [],
        checklists: [],
      }).success,
    ).toBe(true);
  });

  it('rejects a missing title', () => {
    const { title: _title, ...withoutTitle } = validTask;
    expect(taskSchema.safeParse(withoutTitle).success).toBe(false);
  });

  it('rejects null for a required field', () => {
    expect(taskSchema.safeParse({ ...validTask, title: null }).success).toBe(false);
  });

  it('rejects an unsupported priority', () => {
    expect(taskSchema.safeParse({ ...validTask, priority: 'urgent' }).success).toBe(false);
  });

  it('rejects an unknown tag', () => {
    expect(taskSchema.safeParse({ ...validTask, tags: ['urgent'] }).success).toBe(false);
  });

  it('rejects duplicate tags', () => {
    expect(taskSchema.safeParse({ ...validTask, tags: ['feat', 'feat'] }).success).toBe(false);
  });

  it('rejects a negative position', () => {
    expect(taskSchema.safeParse({ ...validTask, position: -1 }).success).toBe(false);
  });

  it('rejects a non-integer position', () => {
    expect(taskSchema.safeParse({ ...validTask, position: 1.5 }).success).toBe(false);
  });

  it('rejects an invalid timestamp', () => {
    expect(taskSchema.safeParse({ ...validTask, createdAt: '2026-11-18' }).success).toBe(false);
  });

  it('rejects a malformed task id', () => {
    expect(taskSchema.safeParse({ ...validTask, id: 'task-001' }).success).toBe(false);
  });

  it('rejects duplicate checklist ids', () => {
    const duplicate = {
      ...validTask,
      checklists: [validTask.checklists[0], validTask.checklists[0]],
    };
    expect(taskSchema.safeParse(duplicate).success).toBe(false);
  });

  it('rejects duplicate checklist item ids within one checklist', () => {
    const checklist = validTask.checklists[0]!;
    const duplicate = {
      ...validTask,
      checklists: [
        {
          ...checklist,
          items: [checklist.items[0], checklist.items[0]],
        },
      ],
    };
    expect(taskSchema.safeParse(duplicate).success).toBe(false);
  });

  it('rejects a blank checklist title and blank item text', () => {
    const checklist = validTask.checklists[0]!;
    expect(
      taskSchema.safeParse({
        ...validTask,
        checklists: [{ ...checklist, title: '  ' }],
      }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({
        ...validTask,
        checklists: [
          { ...checklist, items: [{ ...checklist.items[0]!, text: '   ' }] },
        ],
      }).success,
    ).toBe(false);
  });
});
