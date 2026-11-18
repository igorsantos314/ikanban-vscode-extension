import { describe, expect, it } from 'vitest';
import { deriveColumnId } from './columnId';

describe('deriveColumnId', () => {
  it('creates a lowercase hyphenated identifier', () => {
    expect(deriveColumnId('In Progress')).toBe('in-progress');
  });

  it('removes diacritics', () => {
    expect(deriveColumnId('Ação Rápida')).toBe('acao-rapida');
  });

  it('collapses symbols and trims separators', () => {
    expect(deriveColumnId('  Review / QA!  ')).toBe('review-qa');
  });

  it('falls back when no ascii word survives', () => {
    expect(deriveColumnId('日本語')).toBe('column');
  });

  it('caps the identifier length without a trailing hyphen', () => {
    const id = deriveColumnId('a'.repeat(80));
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('keeps leading digits', () => {
    expect(deriveColumnId('2026 Goals')).toBe('2026-goals');
  });
});
