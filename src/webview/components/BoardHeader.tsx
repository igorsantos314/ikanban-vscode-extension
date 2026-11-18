export function BoardHeader({
  boardName,
  workspaceName,
  columnCount,
  taskCount,
  errorCount,
  warningCount,
  busy,
  onRefresh,
  onValidate,
  onAddColumn,
  onShowValidation,
}: {
  boardName: string;
  workspaceName: string;
  columnCount: number;
  taskCount: number;
  errorCount: number;
  warningCount: number;
  busy: boolean;
  onRefresh(): void;
  onValidate(): void;
  onAddColumn(): void;
  onShowValidation(): void;
}) {
  const issueCount = errorCount + warningCount;
  return (
    <header className="board-toolbar">
      <div className="board-identity">
        <h1 className="board-title">{boardName}</h1>
        <p className="board-subtitle">
          {workspaceName} · {columnCount} columns · {taskCount} tasks
        </p>
      </div>
      <div className="board-actions">
        <button
          type="button"
          className={`btn ${issueCount > 0 ? 'btn-warning' : ''}`}
          onClick={onShowValidation}
          aria-label={`Validation status: ${issueCount} issues`}
        >
          Validation {issueCount > 0 ? `(${issueCount})` : '✓'}
        </button>
        <button type="button" className="btn" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>
        <button type="button" className="btn" onClick={onValidate} disabled={busy}>
          Validate
        </button>
        <button type="button" className="btn btn-primary" onClick={onAddColumn} disabled={busy}>
          + Add column
        </button>
      </div>
    </header>
  );
}
