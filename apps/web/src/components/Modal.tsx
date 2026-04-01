import { useEffect, type ReactNode } from "react";

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

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`modal-panel w-full ${maxWidthClassName} rounded-[1.75rem] bg-white p-5 shadow-2xl md:p-6 ${panelClassName}`}>
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
  );
}
