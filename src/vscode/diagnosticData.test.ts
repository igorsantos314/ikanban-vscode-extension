import { describe, expect, it } from 'vitest';
import { toDiagnosticData } from './diagnosticData';

describe('diagnostic data', () => {
  it('maps severity, code and a reported range', () => {
    const data = toDiagnosticData({
      uri: 'file:///workspace/.ikanban/backlog/task.yaml',
      severity: 'error',
      code: 'schema/invalid',
      message: 'Task title is required.',
      path: 'title',
      range: { startLine: 3, startColumn: 2, endLine: 3, endColumn: 8 },
    });
    expect(data).toEqual({
      uri: 'file:///workspace/.ikanban/backlog/task.yaml',
      severity: 'error',
      code: 'schema/invalid',
      message: 'Task title is required. [title]',
      range: {
        start: { line: 3, character: 2 },
        end: { line: 3, character: 8 },
      },
    });
  });

  it('uses a safe fallback range when no range is available', () => {
    const data = toDiagnosticData({
      uri: 'file:///workspace/.ikanban/board.yaml',
      severity: 'warning',
      code: 'board/unreferenced-directory',
      message: 'Unused column.',
    });
    expect(data.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    });
  });
});
