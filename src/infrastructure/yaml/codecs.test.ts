import { describe, expect, it } from 'vitest';
import {
  parseBoardDocument,
  parseColumnDocument,
  parseTaskDocument,
  revisionOf,
  serializeBoardDocument,
  serializeColumnDocument,
  serializeTaskDocument,
} from './codecs';
import { validTask } from '../../test/helpers/taskFixtures';

const uri = 'file:///workspace/.ikanban/backlog/task.yaml';

describe('document codecs', () => {
  it('parses a board and returns a revision', () => {
    const raw = serializeBoardDocument({
      version: 1,
      name: 'My Project',
      columnIds: ['backlog', 'done'],
    });
    const result = parseBoardDocument(raw, 'file:///board.yaml');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.value).toEqual({
        version: 1,
        name: 'My Project',
        columnIds: ['backlog', 'done'],
      });
      expect(result.document.revision).toBe(revisionOf(raw));
    }
  });

  it('reports unsupported board versions explicitly', () => {
    const raw = 'version: 2\nname: Future\ncolumns: [backlog]\n';
    const result = parseBoardDocument(raw, 'file:///board.yaml');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('schema/unsupported-version');
      expect(result.issues[0]?.message).toContain('Unsupported schema version');
    }
  });

  it('rejects a non-mapping root', () => {
    const result = parseBoardDocument('- one\n- two\n', 'file:///board.yaml');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('schema/root');
    }
  });

  it('parses a column document', () => {
    const raw = serializeColumnDocument({
      id: 'in-progress',
      title: 'In Progress',
      color: '#3b82f6',
    });
    const result = parseColumnDocument(raw, 'file:///column.yaml');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.value.id).toBe('in-progress');
    }
  });

  it('parses a task and attaches its column', () => {
    const raw = serializeTaskDocument(validTask as never);
    const result = parseTaskDocument(raw, uri, 'backlog');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.value.columnId).toBe('backlog');
      expect(result.document.value.title).toBe(validTask.title);
      expect(result.document.value.tags).toEqual(['feat', 'spec']);
    }
  });

  it('normalizes an omitted optional description to an empty string', () => {
    const { description: _description, ...withoutDescription } = validTask;
    const raw = serializeTaskDocument(withoutDescription as never);
    const result = parseTaskDocument(raw, uri, 'backlog');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.value.description).toBe('');
    }
  });

  it('maps schema failures to validation issues with paths', () => {
    const raw = serializeTaskDocument({ ...validTask, priority: 'urgent' } as never);
    const result = parseTaskDocument(raw, uri, 'backlog');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === 'priority')).toBe(true);
      expect(result.issues.every((issue) => issue.uri === uri)).toBe(true);
    }
  });
});
