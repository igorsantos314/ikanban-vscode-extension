import { useState } from 'react';
import type { ColumnView } from '../../shared/board';
import { Modal } from './Modal';

export interface ColumnFormValues {
  title: string;
  color: string;
}

export function ColumnDialog({
  column,
  onSubmit,
  onClose,
}: {
  column?: ColumnView;
  onSubmit(values: ColumnFormValues): Promise<void>;
  onClose(): void;
}) {
  const [title, setTitle] = useState(column?.title ?? '');
  const [color, setColor] = useState(column?.color ?? '#64748b');
  const [errors, setErrors] = useState<{ title?: string; color?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) {
      return;
    }
    const nextErrors: typeof errors = {};
    if (!title.trim()) {
      nextErrors.title = 'Column title is required.';
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      nextErrors.color = 'Color must be a six-digit hexadecimal value.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), color });
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Could not save the column.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={column ? 'Edit column' : 'Add column'}
      onRequestClose={() => {
        if (!saving) {
          onClose();
        }
      }}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save column'}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {errors.form ? (
          <p role="alert" className="error-text">
            {errors.form}
          </p>
        ) : null}
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={title}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'column-title-error' : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {errors.title ? (
          <p id="column-title-error" role="alert" className="error-text">
            {errors.title}
          </p>
        ) : null}

        <label className="field">
          <span>Color</span>
          <span className="flex gap-2">
            <input
              type="color"
              aria-label="Column color picker"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
            <input
              className="input"
              value={color}
              aria-label="Column color hex value"
              aria-invalid={Boolean(errors.color)}
              aria-describedby={errors.color ? 'column-color-error' : undefined}
              onChange={(event) => setColor(event.target.value)}
            />
          </span>
        </label>
        {errors.color ? (
          <p id="column-color-error" role="alert" className="error-text">
            {errors.color}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
