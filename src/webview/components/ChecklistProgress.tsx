function ChecklistIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function ChecklistProgress({
  completed,
  total,
  compact,
}: {
  completed: number;
  total: number;
  compact?: boolean;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <span className="task-card-footer-item checklist-progress">
      <ChecklistIcon />
      <span className="checklist-progress-count">
        {completed}/{total}
      </span>
      {compact ? null : (
        <span
          className="checklist-progress-track"
          role="progressbar"
          aria-label={`Checklist progress ${completed} of ${total}`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of ${total} complete`}
        >
          <span className="checklist-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      )}
    </span>
  );
}
