import type { CardLayout } from '../cardLayout';

export function BoardHeader({
  boardName,
  workspaceName,
  columnCount,
  taskCount,
  errorCount,
  warningCount,
  busy,
  cardLayout,
  onRefresh,
  onValidate,
  onAddColumn,
  onShowValidation,
  onCardLayoutChange,
}: {
  boardName: string;
  workspaceName: string;
  columnCount: number;
  taskCount: number;
  errorCount: number;
  warningCount: number;
  busy: boolean;
  cardLayout: CardLayout;
  onRefresh(): void;
  onValidate(): void;
  onAddColumn(): void;
  onShowValidation(): void;
  onCardLayoutChange(layout: CardLayout): void;
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
        <div className="layout-toggle" role="group" aria-label="Card density">
          <button
            type="button"
            className={`layout-option ${cardLayout === 'expanded' ? 'layout-option-active' : ''}`}
            aria-pressed={cardLayout === 'expanded'}
            onClick={() => onCardLayoutChange('expanded')}
            title="Expanded cards"
          >
            Expanded
          </button>
          <button
            type="button"
            className={`layout-option ${cardLayout === 'compact' ? 'layout-option-active' : ''}`}
            aria-pressed={cardLayout === 'compact'}
            onClick={() => onCardLayoutChange('compact')}
            title="Compact cards"
          >
            Compact
          </button>
        </div>
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
