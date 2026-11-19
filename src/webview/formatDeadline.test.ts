import { describe, expect, it } from 'vitest';
import { formatDeadline } from './formatDeadline';

describe('formatDeadline', () => {
  const dueAt = '2026-11-25T14:30:00.000Z';

  it('formats full and compact local labels', () => {
    const full = formatDeadline(dueAt);
    expect(full?.label).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(full?.full).toBe(full?.label);

    const compact = formatDeadline(dueAt, { compact: true });
    expect(compact?.label).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(compact?.full).toBe(full?.label);
  });

  it('returns null without a deadline or with an invalid one', () => {
    expect(formatDeadline(undefined)).toBeNull();
    expect(formatDeadline('not-a-timestamp')).toBeNull();
  });

  it('derives overdue from the provided clock', () => {
    expect(
      formatDeadline(dueAt, { now: new Date('2026-11-25T14:31:00.000Z') })?.overdue,
    ).toBe(true);
    expect(
      formatDeadline(dueAt, { now: new Date('2026-11-25T14:29:00.000Z') })?.overdue,
    ).toBe(false);
  });
});
