import { IkanbanError } from '../domain/errors';
import type { ProtocolError } from '../shared/protocol';

export function toProtocolError(error: unknown): ProtocolError {
  if (error instanceof IkanbanError) {
    return { code: error.code, message: error.userMessage };
  }
  return {
    code: 'InternalError',
    message: 'An unexpected error occurred. See the iKanban output channel for details.',
  };
}
