import { LineCounter, parseAllDocuments, type Document } from 'yaml';
import {
  createIssue,
  fallbackRange,
  type ValidationIssue,
  type ValidationRange,
} from '../../shared/validationIssue';

export interface ParsedYaml {
  document: Document.Parsed;
  value: unknown;
  lineCounter: LineCounter;
}

export type ParsedYamlResult =
  | { ok: true; parsed: ParsedYaml }
  | { ok: false; issues: ValidationIssue[] };

function rangeFromOffset(lineCounter: LineCounter, offset: number): ValidationRange {
  const position = lineCounter.linePos(offset);
  const line = Math.max(0, position.line - 1);
  const column = Math.max(0, position.col - 1);
  return { startLine: line, startColumn: column, endLine: line, endColumn: column + 1 };
}

function rangeFromError(
  lineCounter: LineCounter,
  offset: number,
  linePos: { line: number; col: number } | undefined,
): ValidationRange {
  if (!linePos) {
    return rangeFromOffset(lineCounter, offset);
  }
  const line = Math.max(0, linePos.line - 1);
  const column = Math.max(0, linePos.col - 1);
  return { startLine: line, startColumn: column, endLine: line, endColumn: column + 1 };
}

export function parseYaml(raw: string, uri: string): ParsedYamlResult {
  const lineCounter = new LineCounter();
  let documents: Document.Parsed[];

  try {
    documents = parseAllDocuments(raw, {
      uniqueKeys: true,
      strict: true,
      prettyErrors: false,
      lineCounter,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [
        createIssue(uri, 'yaml/syntax', `Invalid YAML syntax: ${message}`, {
          range: fallbackRange(),
        }),
      ],
    };
  }

  const issues: ValidationIssue[] = [];

  for (const document of documents) {
    for (const error of document.errors) {
      issues.push(
        createIssue(uri, 'yaml/syntax', error.message, {
          range: rangeFromError(lineCounter, error.pos[0], error.linePos?.[0]),
        }),
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (documents.length > 1) {
    const second = documents[1];
    const offset = second?.range?.[0] ?? 0;
    return {
      ok: false,
      issues: [
        createIssue(
          uri,
          'yaml/multiple-documents',
          'Expected exactly one YAML document, but the file contains multiple documents.',
          { range: rangeFromOffset(lineCounter, offset) },
        ),
      ],
    };
  }

  const document = documents[0];
  if (!document) {
    return {
      ok: false,
      issues: [
        createIssue(uri, 'yaml/syntax', 'The YAML document is empty.', {
          range: fallbackRange(),
        }),
      ],
    };
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [
        createIssue(uri, 'yaml/alias-limit', `Could not expand YAML aliases: ${message}`, {
          range: fallbackRange(),
        }),
      ],
    };
  }

  return { ok: true, parsed: { document, value, lineCounter } };
}

export function zodIssues(
  uri: string,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  parsed?: ParsedYaml,
): ValidationIssue[] {
  return issues.map((issue) => {
    const path = issue.path
      .map((part, index) =>
        typeof part === 'number' ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`,
      )
      .join('');
    let range: ValidationRange | undefined;
    if (parsed && issue.path.length > 0) {
      const lookupPath = issue.path.filter(
        (part): part is string | number => typeof part === 'string' || typeof part === 'number',
      );
      const node = parsed.document.getIn(lookupPath, true);
      if (node && typeof node === 'object' && 'range' in node && Array.isArray(node.range)) {
        const [start, end] = node.range as [number, number];
        const startPos = parsed.lineCounter.linePos(start);
        const endPos = parsed.lineCounter.linePos(end);
        range = {
          startLine: startPos.line - 1,
          startColumn: startPos.col - 1,
          endLine: endPos.line - 1,
          endColumn: Math.max(0, endPos.col - 1),
        };
      }
    }
    return createIssue(uri, 'schema/invalid', issue.message, {
      ...(path ? { path } : {}),
      ...(range ? { range } : {}),
    });
  });
}
