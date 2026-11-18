import { describe, expect, it } from 'vitest';
import { parseYaml } from './parser';

const uri = 'file:///workspace/.ikanban/backlog/task.yaml';

describe('YAML syntax parsing', () => {
  it('parses a valid mapping and returns a document', () => {
    const result = parseYaml('title: Test\nposition: 1\n', uri);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.value).toEqual({ title: 'Test', position: 1 });
    }
  });

  it('rejects invalid indentation with a position', () => {
    const result = parseYaml('title: Test\n  bad: value\n another: value\n', uri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('yaml/syntax');
      expect(result.issues[0]?.range).toBeDefined();
    }
  });

  it('rejects an unclosed quoted string', () => {
    const result = parseYaml('title: "unterminated\n', uri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('yaml/syntax');
    }
  });

  it('rejects duplicate mapping keys', () => {
    const result = parseYaml('title: first\ntitle: second\n', uri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => /duplicate|unique/i.test(issue.message))).toBe(true);
    }
  });

  it('rejects a malformed sequence', () => {
    const result = parseYaml('tags: [feat, spec\n', uri);
    expect(result.ok).toBe(false);
  });

  it('rejects multiple documents', () => {
    const result = parseYaml('title: one\n---\ntitle: two\n', uri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('yaml/multiple-documents');
    }
  });

  it('rejects excessive alias expansion', () => {
    const base = 'a: &a value\n';
    const aliases = Array.from({ length: 120 }, (_, index) => `b${index}: *a`).join('\n');
    const result = parseYaml(`${base}${aliases}\n`, uri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('yaml/alias-limit');
    }
  });
});
