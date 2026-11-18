import { describe, expect, it } from 'vitest';
import { parseYaml } from './parser';
import { serializeTask, updateDocument } from './serializer';
import type { Task } from '../../domain/types';

const id = '550e8400-e29b-41d4-a716-446655440000';
const checklistId = '650e8400-e29b-41d4-a716-446655440001';
const itemId = '750e8400-e29b-41d4-a716-446655440002';

function makeTask(description: string): Task {
  return {
    id,
    title: 'Title',
    description,
    columnId: 'backlog',
    tags: ['issue', 'spec'],
    priority: 'medium',
    position: 1024,
    checklists: [
      {
        id: checklistId,
        title: 'Checklist',
        position: 1024,
        items: [
          { id: itemId, text: 'First item', completed: false, position: 1024 },
        ],
      },
    ],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
  };
}

describe('YAML serialization', () => {
  it('round-trips special characters without semantic changes', () => {
    const values = [
      'Ação — 日本語 — 🚀',
      "It's \"quoted\": #1 \\ path/to/file",
      'line one\n\n  indented line\nline four',
      '  leading and trailing  ',
      'true',
      'false',
      'null',
      '2026-11-18',
      '12345',
      '*alias &anchor',
      '# just a comment-looking value',
      '<b>bold</b> and **markdown**',
      'x'.repeat(5000),
    ];

    for (const description of values) {
      const serialized = serializeTask(makeTask(description));
      const parsed = parseYaml(serialized, 'file:///task.yaml');
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect((parsed.parsed.value as { description: string }).description).toBe(description);
      }
    }
  });

  it('quotes reserved words and date-like strings', () => {
    const serialized = serializeTask(makeTask('true'));
    expect(serialized).toMatch(/description: ['"]true['"]/);
  });

  it('parses CRLF documents and writes valid YAML after an update', () => {
    const raw = serializeTask(makeTask('first')).replace(/\n/g, '\r\n');
    expect(parseYaml(raw, 'file:///task.yaml').ok).toBe(true);

    const updated = updateDocument(raw, { title: 'Second' }, 'file:///task.yaml');
    const parsed = parseYaml(updated, 'file:///task.yaml');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect((parsed.parsed.value as { title: string }).title).toBe('Second');
    }
  });

  it('preserves comments and unknown fields when updating known fields', () => {
    const raw = [
      '# top comment',
      `id: "${id}"`,
      'title: Old',
      'custom: keep-me',
      'description: Text',
      'tags: []',
      'priority: low',
      'position: 1024',
      'checklists: []',
      'createdAt: "2026-11-18T10:00:00.000Z"',
      'updatedAt: "2026-11-18T10:00:00.000Z"',
      '',
    ].join('\n');

    const updated = updateDocument(raw, { title: 'New' }, 'file:///task.yaml');
    expect(updated).toContain('# top comment');
    expect(updated).toContain('custom: keep-me');
    const parsed = parseYaml(updated, 'file:///task.yaml');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect((parsed.parsed.value as { title: string }).title).toBe('New');
      expect((parsed.parsed.value as { custom: string }).custom).toBe('keep-me');
    }
  });

  it('replaces checklist arrays cleanly', () => {
    const task = makeTask('Text');
    const raw = serializeTask(task);
    const updated = updateDocument(raw, { checklists: [] }, 'file:///task.yaml');
    const parsed = parseYaml(updated, 'file:///task.yaml');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect((parsed.parsed.value as { checklists: unknown[] }).checklists).toEqual([]);
    }
  });
});
