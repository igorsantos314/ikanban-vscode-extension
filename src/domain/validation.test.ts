import { describe, expect, it } from 'vitest';
import {
  assertIsoTimestamp,
  assertNonNegativeInteger,
  assertPriority,
  assertUniqueIds,
  normalizeRequiredText,
} from './validation';
import { ValidationError } from './errors';

describe('domain validation', () => {
  it('trims required text and rejects blank values', () => {
    expect(normalizeRequiredText('  Task title  ', 'Task title')).toBe('Task title');
    expect(() => normalizeRequiredText('   ', 'Task title')).toThrow(
      'Task title is required.',
    );
  });

  it('accepts only supported priorities', () => {
    expect(() => assertPriority('high')).not.toThrow();
    expect(() => assertPriority('urgent')).toThrow(ValidationError);
  });

  it('requires non-negative integers for positions', () => {
    expect(() => assertNonNegativeInteger(0, 'Position')).not.toThrow();
    expect(() => assertNonNegativeInteger(-1, 'Position')).toThrow(
      'Position must be a non-negative integer.',
    );
    expect(() => assertNonNegativeInteger(1.5, 'Position')).toThrow(ValidationError);
  });

  it('requires ISO 8601 UTC timestamps', () => {
    expect(() => assertIsoTimestamp('2026-11-18T10:00:00.000Z', 'createdAt')).not.toThrow();
    expect(() => assertIsoTimestamp('2026-11-18', 'createdAt')).toThrow(ValidationError);
    expect(() => assertIsoTimestamp('not-a-date', 'createdAt')).toThrow(ValidationError);
  });

  it('rejects duplicate identifiers', () => {
    expect(() => assertUniqueIds(['a', 'b'], 'Checklist ID')).not.toThrow();
    expect(() => assertUniqueIds(['a', 'a'], 'Checklist ID')).toThrow(
      'Duplicate Checklist ID: a',
    );
  });
});
