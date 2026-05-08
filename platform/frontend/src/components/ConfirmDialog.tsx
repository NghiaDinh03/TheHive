'use client';

/**
 * Confirm dialog — mirrors TheHive 4 legacy confirm.modal.html.
 * AdminLTE modal style with danger/warning/info variants.
 */

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
};

const VARIANT_CLASSES: Record<string, string> = {
  danger: 'btn-danger',
  warning: 'btn-warning',
  info: 'btn-primary',
};

const HEADER_CLASSES: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-primary',
};

export function ConfirmDialog({
  open,
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  pending,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop-th4" role="dialog" aria-modal="true">
      <div className="modal-dialog th4-modal-dialog" style={{ maxWidth: 480 }}>
        <div className="modal-content th4-modal-content">
          <div className={`modal-header ${HEADER_CLASSES[variant] ?? 'bg-primary'}`}>
            <button type="button" className="close" onClick={onCancel} aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
            <h3 className="modal-title">{title}</h3>
          </div>
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onCancel} disabled={!!pending}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${VARIANT_CLASSES[variant] ?? 'btn-primary'}`}
              onClick={onConfirm}
              disabled={!!pending}
            >
              {pending ? 'Processing…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
