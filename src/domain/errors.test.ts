import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DuplicateEntityError,
  EntityNotFoundError,
  IkanbanError,
  StorageError,
  UnsupportedSchemaVersionError,
  ValidationError,
  WorkspaceNotAvailableError,
  WorkspaceNotTrustedError,
} from './errors';

describe('application errors', () => {
  it('exposes stable codes and user messages', () => {
    const samples: Array<[IkanbanError, string, string]> = [
      [new ValidationError('Task title is required.'), 'ValidationError', 'Task title is required.'],
      [new EntityNotFoundError('Task', 'abc'), 'EntityNotFoundError', 'Task not found: abc.'],
      [new DuplicateEntityError('Column', 'done'), 'DuplicateEntityError', 'Column already exists: done.'],
      [new StorageError('Could not write the task.'), 'StorageError', 'Could not write the task.'],
      [new ConflictError('Task'), 'ConflictError', 'This task was modified outside iKanban. Reload before saving.'],
      [
        new UnsupportedSchemaVersionError(2),
        'UnsupportedSchemaVersionError',
        'Unsupported schema version: 2. This version of iKanban supports version 1.',
      ],
      [new WorkspaceNotAvailableError(), 'WorkspaceNotAvailableError', 'Open a workspace folder before using iKanban.'],
      [new WorkspaceNotTrustedError(), 'WorkspaceNotTrustedError', 'iKanban requires a trusted workspace to create and modify board files.'],
    ];

    for (const [error, code, message] of samples) {
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.userMessage).toBe(message);
    }
  });

  it('keeps technical details separate from the user message', () => {
    const error = new StorageError('Could not write the task.', 'EACCES: permission denied');
    expect(error.userMessage).toBe('Could not write the task.');
    expect(error.technicalMessage).toBe('EACCES: permission denied');
  });
});
