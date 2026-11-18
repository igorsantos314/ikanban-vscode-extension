import { ValidationError } from '../../domain/errors';

export const BOARD_FILE = 'board.yaml';
export const COLUMN_FILE = 'column.yaml';

const SAFE_COLUMN_ID = /^[a-z0-9][a-z0-9-]*$/;

export function isSafeColumnId(id: string): boolean {
  return SAFE_COLUMN_ID.test(id) && !id.includes('..');
}

export function assertSafeColumnId(id: string): string {
  if (!isSafeColumnId(id)) {
    throw new ValidationError(`Invalid column ID: ${id}`, `Unsafe column identifier: ${id}`);
  }
  return id;
}

export function isTaskFileName(name: string): boolean {
  return (
    name.endsWith('.yaml') &&
    name !== COLUMN_FILE &&
    name !== BOARD_FILE &&
    !name.startsWith('.') &&
    !name.includes('.tmp.')
  );
}

export function taskFileName(taskId: string): string {
  return `${taskId}.yaml`;
}
