import { describe, expect, it } from 'vitest';
import { isTagId, normalizeTags, TAG_IDS } from './tags';
import { ValidationError } from './errors';

describe('tags', () => {
  it('exposes the canonical tag identifiers in deterministic order', () => {
    expect(TAG_IDS).toEqual(['issue', 'feat', 'chore', 'spec']);
  });

  it('recognizes only supported tags', () => {
    expect(isTagId('issue')).toBe(true);
    expect(isTagId('urgent')).toBe(false);
  });

  it('sorts tags by canonical order', () => {
    expect(normalizeTags(['spec', 'issue', 'chore'])).toEqual([
      'issue',
      'chore',
      'spec',
    ]);
  });

  it('rejects unknown tags', () => {
    expect(() => normalizeTags(['urgent'])).toThrow(ValidationError);
    expect(() => normalizeTags(['urgent'])).toThrow('Unsupported tag: urgent');
  });

  it('rejects duplicate tags', () => {
    expect(() => normalizeTags(['issue', 'issue'])).toThrow('Duplicate tag: issue');
  });
});
