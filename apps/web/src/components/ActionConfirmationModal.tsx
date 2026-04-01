import type { ReactNode } from "react";
import { Modal } from "@/components/Modal";

type ActionConfirmationModalProps = {
  open: boolean;
  tone?: "cobalt" | "rose" | "sunset" | "lagoon" | "forest";
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isPending?: boolean;
  details?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ActionConfirmationModal({
  open,
  tone = "cobalt",
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isPending = false,
  details,
  onConfirm,
  onClose
}: ActionConfirmationModalProps) {
  return (
    <Modal open={open} title={title} onClose={onClose} hideHeader panelClassName="action-confirm-modal-panel" maxWidthClassName="max-w-lg">
      <div className={`action-confirm-card action-confirm-card-${tone}`}>
        <div className="action-confirm-glow" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`action-confirm-icon action-confirm-icon-${tone}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 7v6" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.3 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <div>
                <p className="action-confirm-eyebrow">{eyebrow}</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-sand-700">{description}</p>
              </div>
            </div>

            <button type="button" onClick={onClose} className="action-confirm-close" aria-label="Close confirmation">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {details ? <div className="action-confirm-details">{details}</div> : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onClose} className="action-confirm-secondary" disabled={isPending}>
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} className={`action-confirm-primary action-confirm-primary-${tone}`} disabled={isPending}>
              {isPending ? "Working..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
