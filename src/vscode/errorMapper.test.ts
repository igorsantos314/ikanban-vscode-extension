import { describe, expect, it } from 'vitest';
import { ConflictError, StorageError, ValidationError } from '../domain/errors';
import { toProtocolError } from './errorMapper';

describe('protocol error mapping', () => {
  it('maps application errors to stable codes and messages', () => {
    expect(toProtocolError(new ValidationError('Task title is required.'))).toEqual({
      code: 'ValidationError',
      message: 'Task title is required.',
    });
    expect(toProtocolError(new ConflictError('Task')).code).toBe('ConflictError');
  });

  it('never exposes technical details or stack traces', () => {
    const mapped = toProtocolError(new StorageError('Could not write.', 'EACCES secret path'));
    expect(mapped).toEqual({ code: 'StorageError', message: 'Could not write.' });
    expect(JSON.stringify(mapped)).not.toContain('EACCES');
  });

  it('maps unexpected errors to a generic message', () => {
    const mapped = toProtocolError(new Error('secret stack'));
    expect(mapped.code).toBe('InternalError');
    expect(mapped.message).not.toContain('secret');
  });
});
