import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CARD_LAYOUT,
  cardLayoutStorageKey,
  readCardLayout,
  writeCardLayout,
  type CardLayoutStorage,
} from './cardLayout';

function memoryStorage(initial: Record<string, string> = {}): CardLayoutStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('card layout preference', () => {
  it('defaults to expanded when no preference exists', () => {
    expect(readCardLayout('workspace', memoryStorage())).toBe(DEFAULT_CARD_LAYOUT);
    expect(DEFAULT_CARD_LAYOUT).toBe('expanded');
  });

  it('round-trips the selected layout per workspace', () => {
    const storage = memoryStorage();
    writeCardLayout('alpha', 'compact', storage);
    writeCardLayout('beta', 'expanded', storage);
    expect(readCardLayout('alpha', storage)).toBe('compact');
    expect(readCardLayout('beta', storage)).toBe('expanded');
    expect(readCardLayout('gamma', storage)).toBe('expanded');
    expect(storage.values.get(cardLayoutStorageKey('alpha'))).toBe('compact');
  });

  it('ignores unknown stored values', () => {
    const storage = memoryStorage({ [cardLayoutStorageKey('workspace')]: 'huge' });
    expect(readCardLayout('workspace', storage)).toBe('expanded');
  });

  it('falls back to expanded when storage is unavailable', () => {
    expect(readCardLayout('workspace', undefined)).toBe('expanded');
    expect(() => writeCardLayout('workspace', 'compact', undefined)).not.toThrow();
  });

  it('falls back when reads or writes throw', () => {
    const storage: CardLayoutStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };
    expect(readCardLayout('workspace', storage)).toBe('expanded');
    expect(() => writeCardLayout('workspace', 'compact', storage)).not.toThrow();
  });

  it('uses the browser storage by default', () => {
    localStorage.clear();
    writeCardLayout('browser', 'compact');
    expect(readCardLayout('browser')).toBe('compact');
    localStorage.clear();
  });
});
