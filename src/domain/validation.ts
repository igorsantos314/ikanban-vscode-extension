import { ValidationError } from './errors';
import { requirePriority, type Priority } from './types';

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRequiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${label} is required.`);
  }
  return trimmed;
}

export function assertPriority(value: string): asserts value is Priority {
  requirePriority(value);
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative integer.`);
  }
}

export function isIsoTimestamp(value: string): boolean {
  return ISO_UTC_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function assertIsoTimestamp(value: string, label: string): void {
  if (!isIsoTimestamp(value)) {
    throw new ValidationError(`${label} must be a valid ISO 8601 UTC timestamp.`);
  }
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(value: string, label: string): string {
  if (!isUuid(value)) {
    throw new ValidationError(`${label} must be a valid UUID.`);
  }
  return value;
}

export function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new ValidationError(`Duplicate ${label}: ${id}`);
    }
    seen.add(id);
  }
}
