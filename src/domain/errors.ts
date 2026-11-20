export type ErrorCode =
  | 'ValidationError'
  | 'EntityNotFoundError'
  | 'DuplicateEntityError'
  | 'StorageError'
  | 'ConflictError'
  | 'PaginationConflict'
  | 'UnsupportedSchemaVersionError'
  | 'WorkspaceNotAvailableError'
  | 'WorkspaceNotTrustedError';

export class IkanbanError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly technicalMessage: string | undefined;

  constructor(code: ErrorCode, userMessage: string, technicalMessage?: string) {
    super(userMessage);
    this.name = code;
    this.code = code;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
  }
}

export class ValidationError extends IkanbanError {
  constructor(message: string, technicalMessage?: string) {
    super('ValidationError', message, technicalMessage);
  }
}

export class EntityNotFoundError extends IkanbanError {
  constructor(entity: string, id: string) {
    super('EntityNotFoundError', `${entity} not found: ${id}.`);
  }
}

export class DuplicateEntityError extends IkanbanError {
  constructor(entity: string, id: string) {
    super('DuplicateEntityError', `${entity} already exists: ${id}.`);
  }
}

export class StorageError extends IkanbanError {
  constructor(message: string, technicalMessage?: string) {
    super('StorageError', message, technicalMessage);
  }
}

export class ConflictError extends IkanbanError {
  constructor(entity: string) {
    super(
      'ConflictError',
      `This ${entity.toLowerCase()} was modified outside iKanban. Reload before saving.`,
    );
  }
}

export class PaginationConflictError extends IkanbanError {
  constructor() {
    super(
      'PaginationConflict',
      'This column changed while loading more tasks. The column will reload.',
    );
  }
}

export class UnsupportedSchemaVersionError extends IkanbanError {
  constructor(version: unknown) {
    super(
      'UnsupportedSchemaVersionError',
      `Unsupported schema version: ${String(version)}. This version of iKanban supports version 1.`,
    );
  }
}

export class WorkspaceNotAvailableError extends IkanbanError {
  constructor() {
    super('WorkspaceNotAvailableError', 'Open a workspace folder before using iKanban.');
  }
}

export class WorkspaceNotTrustedError extends IkanbanError {
  constructor() {
    super(
      'WorkspaceNotTrustedError',
      'iKanban requires a trusted workspace to create and modify board files.',
    );
  }
}
