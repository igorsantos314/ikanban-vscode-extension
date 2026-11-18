import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MANAGED_BLOCK,
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  mergeAgentsContent,
} from './agentSkill';

const skill = readFileSync(
  join(process.cwd(), 'resources', 'skills', 'ikanban', 'SKILL.md'),
  'utf8',
);

describe('iKanban skill asset', () => {
  it('has portable Agent Skills metadata', () => {
    expect(skill).toMatch(/^---\nname: ikanban\n/);
    expect(skill).toContain('description:');
  });

  it('documents the storage layout and task schema', () => {
    expect(skill).toContain('.ikanban/board.yaml');
    expect(skill).toContain('column.yaml');
    for (const field of ['id', 'title', 'description', 'tags', 'priority', 'position', 'createdAt', 'updatedAt']) {
      expect(skill).toContain(field);
    }
    expect(skill).toContain('checklists');
  });

  it('documents timestamp rules', () => {
    expect(skill).toContain('YYYY-MM-DDTHH:MM:SS.sssZ');
    expect(skill).toContain('createdAt == updatedAt');
    expect(skill).toContain('createdAt` | ISO 8601 UTC instant, unchanged');
  });

  it('documents the required operations', () => {
    expect(skill).toContain('Create a task');
    expect(skill).toContain('Update a task');
    expect(skill).toContain('Move a task');
    expect(skill).toContain('Reorder inside a column');
    expect(skill).toContain('Remove a task');
    expect(skill).toContain('iKanban: Create New Task');
  });

  it('forbids status and column fields and requires validation', () => {
    expect(skill).toContain('no `status` field');
    expect(skill).toContain('`columnId`');
    expect(skill).toContain('Validation checklist');
    expect(skill).toContain('Ask for explicit confirmation');
  });
});

describe('mergeAgentsContent', () => {
  it('creates the managed block when the file is missing', () => {
    const merged = mergeAgentsContent(undefined);

    expect(merged).toBe(`${MANAGED_BLOCK}\n`);
    expect(merged.match(/ikanban-skill:start/g)).toHaveLength(1);
    expect(merged.match(/ikanban-skill:end/g)).toHaveLength(1);
  });

  it('preserves existing project instructions', () => {
    const existing = '# Project instructions\n\nAlways run the tests.\n';

    const merged = mergeAgentsContent(existing);

    expect(merged.startsWith(existing)).toBe(true);
    expect(merged).toContain(MANAGED_BLOCK_START);
    expect(merged).toContain(MANAGED_BLOCK_END);
  });

  it('replaces an existing managed block without duplicating it', () => {
    const existing = [
      '# Instructions',
      '',
      MANAGED_BLOCK_START,
      'old pointer',
      MANAGED_BLOCK_END,
      '',
      'Keep this trailing section.',
      '',
    ].join('\n');

    const once = mergeAgentsContent(existing);
    const twice = mergeAgentsContent(once);

    expect(once).toContain('Keep this trailing section.');
    expect(once).not.toContain('old pointer');
    expect(once.match(/ikanban-skill:start/g)).toHaveLength(1);
    expect(twice).toBe(once);
  });
});
