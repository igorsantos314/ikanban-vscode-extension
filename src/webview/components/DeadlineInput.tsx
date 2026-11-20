import { useRef } from 'react';

export interface DeadlineDraft {
  date: string;
  time: string;
}

export function maskDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(
    (part) => part.length > 0,
  );
  return parts.join('/');
}

export function maskTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function hasFullDate(value: string): boolean {
  return value.replace(/\D/g, '').length === 8;
}

export function hasFullTime(value: string): boolean {
  return value.replace(/\D/g, '').length === 4;
}

export function DeadlineInput({
  value,
  onChange,
  error,
  errorId = 'task-deadline-error',
}: {
  value: DeadlineDraft;
  onChange(value: DeadlineDraft): void;
  error?: string;
  errorId?: string;
}) {
  const timeRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field">
      <span id="task-deadline-label">Due date and time</span>
      <div
        className="deadline-input"
        role="group"
        aria-labelledby="task-deadline-label"
      >
        <input
          className="input deadline-date"
          value={value.date}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Deadline date"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const date = maskDate(event.target.value);
            onChange({ ...value, date });
            if (hasFullDate(date)) {
              timeRef.current?.focus();
            }
          }}
        />
        <input
          ref={timeRef}
          className="input deadline-time"
          value={value.time}
          placeholder="HH:MM"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Deadline time"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange({ ...value, time: maskTime(event.target.value) })}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Clear deadline"
          title="Clear deadline"
          disabled={!hasFullDate(value.date) && !hasFullTime(value.time)}
          onClick={() => onChange({ date: '', time: '' })}
        >
          ×
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
