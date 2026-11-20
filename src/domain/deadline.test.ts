import { describe, expect, it } from 'vitest';
import {
  isDeadlineOverdue,
  joinLocalDeadline,
  normalizeDueAt,
  parseLocalDeadline,
  splitDueAt,
} from './deadline';

describe('deadline conversion', () => {
  it('round-trips a local date and time through UTC', () => {
    const dueAt = joinLocalDeadline('25/11/2026', '14:30');
    expect(dueAt).toMatch(/Z$/);
    expect(splitDueAt(dueAt)).toEqual({ date: '25/11/2026', time: '14:30' });
  });

  it('treats an empty pair as no deadline', () => {
    expect(parseLocalDeadline('', '')).toEqual({ ok: true, dueAt: undefined });
  });

  it('rejects a partial date or time', () => {
    expect(parseLocalDeadline('25/11/2026', '')).toMatchObject({ ok: false });
    expect(parseLocalDeadline('', '14:30')).toMatchObject({ ok: false });
  });

  it('rejects impossible calendar dates', () => {
    const result = parseLocalDeadline('31/02/2026', '10:00');
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ message: expect.stringContaining('valid calendar') });
  });

  it('rejects out-of-range times', () => {
    expect(parseLocalDeadline('25/11/2026', '24:00').ok).toBe(false);
    expect(parseLocalDeadline('25/11/2026', '14:60').ok).toBe(false);
  });

  it('rejects the wrong separators', () => {
    expect(parseLocalDeadline('2026-11-25', '14:30').ok).toBe(false);
    expect(parseLocalDeadline('25/11/2026', '2:30').ok).toBe(false);
  });

  it('accepts a DST-adjacent date without losing the local minute', () => {
    const dueAt = joinLocalDeadline('29/03/2026', '01:30');
    expect(splitDueAt(dueAt)).toEqual({ date: '29/03/2026', time: '01:30' });
  });

  it('normalizes persisted deadline input', () => {
    expect(normalizeDueAt(undefined)).toBeUndefined();
    expect(normalizeDueAt(null)).toBeUndefined();
    expect(normalizeDueAt('')).toBeUndefined();
    expect(normalizeDueAt('2026-11-25T14:30:00.000Z')).toBe('2026-11-25T14:30:00.000Z');
    expect(() => normalizeDueAt('2026-11-25')).toThrow(/ISO 8601/);
  });

  it('derives overdue state', () => {
    expect(isDeadlineOverdue('2026-11-25T14:30:00.000Z', new Date('2026-11-25T14:31:00.000Z'))).toBe(
      true,
    );
    expect(isDeadlineOverdue('2026-11-25T14:30:00.000Z', new Date('2026-11-25T14:29:00.000Z'))).toBe(
      false,
    );
  });
});
