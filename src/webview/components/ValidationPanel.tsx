import type { ValidationIssue } from '../../shared/validationIssue';
import { Modal } from './Modal';

export function ValidationPanel({
  issues,
  onClose,
  onOpenIssue,
}: {
  issues: readonly ValidationIssue[];
  onClose(): void;
  onOpenIssue(issue: ValidationIssue): void;
}) {
  return (
    <Modal
      title="Validation issues"
      wide
      onRequestClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      }
    >
      {issues.length === 0 ? (
        <p>The board is valid. No issues were found.</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, index) => (
            <li key={`${issue.uri}-${issue.code}-${index}`}>
              <button
                type="button"
                className="issue-row"
                onClick={() => onOpenIssue(issue)}
                aria-label={`Open ${issue.uri}: ${issue.message}`}
              >
                <span className={`issue-severity issue-${issue.severity}`}>
                  {issue.severity === 'error' ? 'Error' : 'Warning'}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block">{issue.message}</span>
                  <span className="block break-all text-xs opacity-70">
                    {issue.uri}
                    {issue.path ? ` · ${issue.path}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
