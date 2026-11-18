import { describe, expect, it } from 'vitest';
import { formatTimestamp } from './formatTimestamp';

describe('formatTimestamp', () => {
  it('formats a valid ISO timestamp with the requested locale and time zone', () => {
    const formatted = formatTimestamp('2026-11-18T10:00:00.000Z', 'en-US', 'UTC');

    expect(formatted).toContain('Nov 18, 2026');
    expect(formatted).toContain('10:00');
  });

  it('uses the requested locale', () => {
    const formatted = formatTimestamp('2026-11-18T10:00:00.000Z', 'de-DE', 'UTC');

    expect(formatted).toContain('18.11.2026');
  });

  it('honours the requested time zone', () => {
    const formatted = formatTimestamp(
      '2026-11-18T10:00:00.000Z',
      'en-US',
      'America/Sao_Paulo',
    );

    expect(formatted).toContain('7:00');
  });

  it('returns the original value when it is not a valid date', () => {
    expect(formatTimestamp('not-a-date', 'en-US', 'UTC')).toBe('not-a-date');
  });
});
