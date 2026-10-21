import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n/useT";
import { CloseIcon } from "./icons";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Set while a child handles Escape itself (e.g. key capture). */
  ignoreEscape?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({ title, onClose, children, ignoreEscape }: DialogProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  // Move focus in on open and give it back to whatever opened the dialog on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ignoreEscape) {
        onClose();
        return;
      }
      // Keep Tab cycling inside the dialog.
      if (e.key === "Tab" && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, ignoreEscape]);

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t("close")}>
            <CloseIcon />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
