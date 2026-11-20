import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  stacked,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
  busy?: boolean;
  stacked?: boolean;
}) {
  return (
    <Modal
      title={title}
      onRequestClose={onCancel}
      stacked={stacked}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-wrap">{message}</p>
    </Modal>
  );
}
