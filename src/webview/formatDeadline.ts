import { isDeadlineOverdue, splitDueAt } from '../domain/deadline';

export interface FormattedDeadline {
  label: string;
  full: string;
  overdue: boolean;
}

export function formatDeadline(
  dueAt: string | undefined,
  options: { compact?: boolean; now?: Date } = {},
): FormattedDeadline | null {
  if (!dueAt) {
    return null;
  }
  const parts = splitDueAt(dueAt);
  if (!parts) {
    return null;
  }
  const full = `${parts.date} ${parts.time}`;
  const label = options.compact
    ? `${parts.date.slice(0, 5)} ${parts.time}`
    : full;
  return {
    label,
    full,
    overdue: isDeadlineOverdue(dueAt, options.now),
  };
}
