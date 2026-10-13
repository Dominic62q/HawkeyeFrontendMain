import { useEffect, useRef, type ReactNode } from "react";

/** A modal built on <dialog>, which gives focus trapping and Esc for free. */
export function Dialog({
  title,
  onClose,
  children,
  narrow = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dlg ${narrow ? "narrow" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself, not on its body.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dlg-body">
        <header className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
