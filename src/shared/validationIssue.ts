export type ValidationSeverity = 'error' | 'warning';

export interface ValidationRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type ValidationIssueCode =
  | 'yaml/syntax'
  | 'yaml/multiple-documents'
  | 'yaml/alias-limit'
  | 'schema/root'
  | 'schema/invalid'
  | 'schema/unsupported-version'
  | 'board/missing-column'
  | 'board/missing-column-config'
  | 'board/column-identity'
  | 'board/duplicate-column'
  | 'board/unreferenced-directory'
  | 'task/duplicate-id'
  | 'task/identity-mismatch'
  | 'task/invalid-file'
  | 'task/index-error'
  | 'task/page-error'
  | 'task/missing-file';

export interface ValidationIssue {
  uri: string;
  severity: ValidationSeverity;
  code: ValidationIssueCode;
  message: string;
  path?: string;
  range?: ValidationRange;
}

export function createIssue(
  uri: string,
  code: ValidationIssueCode,
  message: string,
  options: { severity?: ValidationSeverity; path?: string; range?: ValidationRange } = {},
): ValidationIssue {
  return {
    uri,
    code,
    severity: options.severity ?? 'error',
    message,
    ...(options.path ? { path: options.path } : {}),
    ...(options.range ? { range: options.range } : {}),
  };
}

export function fallbackRange(): ValidationRange {
  return { startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 };
}
