import { ValidationError } from './errors';

export const TAG_IDS = ['issue', 'feat', 'chore', 'spec'] as const;

export type TagId = (typeof TAG_IDS)[number];

const TAG_ORDER = new Map<TagId, number>(TAG_IDS.map((tag, index) => [tag, index]));

export function isTagId(value: string): value is TagId {
  return TAG_IDS.includes(value as TagId);
}

export function normalizeTags(values: readonly string[]): TagId[] {
  const seen = new Set<string>();
  const normalized: TagId[] = [];

  for (const value of values) {
    if (!isTagId(value)) {
      throw new ValidationError(`Unsupported tag: ${value}`);
    }
    if (seen.has(value)) {
      throw new ValidationError(`Duplicate tag: ${value}`);
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized.sort((left, right) => (TAG_ORDER.get(left) ?? 0) - (TAG_ORDER.get(right) ?? 0));
}
