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
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{boardName}</h1>
        <p className="text-xs opacity-70">
          {workspaceName} · {columnCount} columns · {taskCount} tasks
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
