import type { ValidationIssue, ValidationSeverity } from '../shared/validationIssue';

export interface DiagnosticPositionData {
  line: number;
  character: number;
}

export interface DiagnosticRangeData {
  start: DiagnosticPositionData;
  end: DiagnosticPositionData;
}

export interface DiagnosticData {
  uri: string;
  severity: ValidationSeverity;
  message: string;
  code: string;
  range: DiagnosticRangeData;
}

export function toDiagnosticData(issue: ValidationIssue): DiagnosticData {
  const range = issue.range ?? {
    startLine: 0,
    startColumn: 0,
    endLine: 0,
    endColumn: 1,
  };
  return {
    uri: issue.uri,
    severity: issue.severity,
    message: issue.path ? `${issue.message} [${issue.path}]` : issue.message,
    code: issue.code,
    range: {
      start: { line: range.startLine, character: range.startColumn },
      end: { line: range.endLine, character: range.endColumn },
    },
  };
}
