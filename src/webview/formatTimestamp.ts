const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

export function formatTimestamp(value: string, locale?: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      ...DEFAULT_FORMAT,
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return value;
  }
}
