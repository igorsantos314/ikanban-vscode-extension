import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, Uri, languages } from 'vscode';
import type { ValidationIssue } from '../shared/validationIssue';
import { toDiagnosticData } from './diagnosticData';

export class DiagnosticsManager {
  private readonly collection: DiagnosticCollection;

  constructor() {
    this.collection = languages.createDiagnosticCollection('iKanban');
  }

  publish(issues: readonly ValidationIssue[]): void {
    this.collection.clear();
    const byUri = new Map<string, Diagnostic[]>();
    for (const issue of issues) {
      const data = toDiagnosticData(issue);
      const diagnostic = new Diagnostic(
        new Range(
          data.range.start.line,
          data.range.start.character,
          data.range.end.line,
          data.range.end.character,
        ),
        data.message,
        data.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
      );
      diagnostic.code = data.code;
      diagnostic.source = 'iKanban';
      const existing = byUri.get(data.uri) ?? [];
      existing.push(diagnostic);
      byUri.set(data.uri, existing);
    }
    for (const [uri, diagnostics] of byUri) {
      this.collection.set(Uri.parse(uri), diagnostics);
    }
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }
}
