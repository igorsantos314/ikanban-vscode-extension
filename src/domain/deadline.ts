import { ValidationError } from './errors';
import { isIsoTimestamp } from './validation';

export interface LocalDeadline {
  date: string;
  time: string;
}

export type ParsedLocalDeadline =
  | { ok: true; dueAt: string | undefined }
  | { ok: false; message: string };

const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function splitDueAt(dueAt: string): LocalDeadline | null {
  if (!isIsoTimestamp(dueAt)) {
    return null;
  }
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function toLocalDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date | null {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }
  return date;
}

export function parseLocalDeadline(
  dateValue: string,
  timeValue: string,
): ParsedLocalDeadline {
  const date = dateValue.trim();
  const time = timeValue.trim();
  if (date.length === 0 && time.length === 0) {
    return { ok: true, dueAt: undefined };
  }
  if (date.length === 0 || time.length === 0) {
    return { ok: false, message: 'Fill in both the deadline date and time.' };
  }

  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch) {
    return { ok: false, message: 'Use the date format DD/MM/AAAA.' };
  }
  if (!timeMatch) {
    return { ok: false, message: 'Use the time format HH:MM.' };
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const local = toLocalDate(year, month, day, hours, minutes);
  if (!local) {
    return { ok: false, message: 'Enter a valid calendar date and time.' };
  }
  return { ok: true, dueAt: local.toISOString() };
}

export function joinLocalDeadline(date: string, time: string): string {
  const parsed = parseLocalDeadline(date, time);
  if (!parsed.ok) {
    throw new ValidationError(parsed.message);
  }
  if (!parsed.dueAt) {
    throw new ValidationError('Deadline requires a date and a time.');
  }
  return parsed.dueAt;
}

export function normalizeDueAt(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value.trim().length === 0) {
    return undefined;
  }
  if (!isIsoTimestamp(value)) {
    throw new ValidationError('Deadline must be a valid ISO 8601 UTC timestamp.');
  }
  return value;
}

export function isDeadlineOverdue(dueAt: string, now: Date = new Date()): boolean {
  const deadline = Date.parse(dueAt);
  return !Number.isNaN(deadline) && deadline < now.getTime();
}
