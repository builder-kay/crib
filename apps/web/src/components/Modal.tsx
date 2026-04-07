import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  hideHeader?: boolean;
  panelClassName?: string;
  maxWidthClassName?: string;
};

export function Modal({ open, title, children, onClose, hideHeader = false, panelClassName = "", maxWidthClassName = "max-w-md" }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const activeLocks = Number(body.dataset.modalLockCount ?? "0");

    if (activeLocks === 0) {
      body.dataset.modalOriginalOverflow = body.style.overflow;
      body.dataset.modalOriginalPaddingRight = body.style.paddingRight;
      html.dataset.modalOriginalOverflow = html.style.overflow;

      const scrollbarWidth = window.innerWidth - html.clientWidth;
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    body.dataset.modalLockCount = String(activeLocks + 1);

    return () => {
      const nextLocks = Math.max(Number(body.dataset.modalLockCount ?? "1") - 1, 0);

      if (nextLocks === 0) {
        body.style.overflow = body.dataset.modalOriginalOverflow ?? "";
        body.style.paddingRight = body.dataset.modalOriginalPaddingRight ?? "";
        html.style.overflow = html.dataset.modalOriginalOverflow ?? "";

        delete body.dataset.modalLockCount;
        delete body.dataset.modalOriginalOverflow;
        delete body.dataset.modalOriginalPaddingRight;
        delete html.dataset.modalOriginalOverflow;
        return;
      }

      body.dataset.modalLockCount = String(nextLocks);
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-[3px] sm:px-6 sm:py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`modal-panel relative w-full ${maxWidthClassName} max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] bg-white p-5 shadow-2xl md:p-6 ${panelClassName}`}
        >
          {!hideHeader ? (
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
              <button type="button" onClick={onClose} className="rounded-full border border-sand-200 px-3 py-1.5 text-sm font-semibold text-sand-600 transition hover:bg-sand-100">
                Close
              </button>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
