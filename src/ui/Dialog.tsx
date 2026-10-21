import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n/useT";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Set while a child handles Escape itself (e.g. key capture). */
  ignoreEscape?: boolean;
}

export function Dialog({ title, onClose, children, ignoreEscape }: DialogProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ignoreEscape) onClose();
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
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
