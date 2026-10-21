import { useEffect, useState } from "react";
import { settings } from "../app/services";
import { bindingError, withBinding, type BindingError } from "../app/settings";
import { DEFAULT_BINDINGS, codeLabel, type BindableAction } from "../core/keymap";
import type { MessageKey } from "../i18n/strings";
import { useSettings, useT } from "../i18n/useT";
import { Dialog } from "./Dialog";

const ACTIONS: { action: BindableAction; label: MessageKey }[] = [
  { action: "octaveDown1", label: "bindings.octaveDown1" },
  { action: "octaveUp1", label: "bindings.octaveUp1" },
  { action: "octaveDown2", label: "bindings.octaveDown2" },
  { action: "octaveUp2", label: "bindings.octaveUp2" },
  { action: "sustain", label: "bindings.sustain" },
];

const ERROR_MESSAGES: Record<BindingError, MessageKey> = {
  noteKey: "bindings.err.noteKey",
  modifier: "bindings.err.modifier",
  reserved: "bindings.err.reserved",
};

export function BindingsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { bindings } = useSettings();
  const [capturing, setCapturing] = useState<BindableAction | null>(null);
  const [error, setError] = useState<BindingError | null>(null);

  // While capturing, swallow the next key press so it neither plays nor closes the dialog.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === "Escape") {
        setCapturing(null);
        return;
      }
      const err = bindingError(e.code);
      if (err) {
        setError(err);
        return;
      }
      settings.set({ bindings: withBinding(settings.get().bindings, capturing, e.code) });
      setError(null);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [capturing]);

  return (
    <Dialog title={t("bindings.title")} onClose={onClose} ignoreEscape={capturing !== null}>
      <p className="dialog-note">{t("bindings.note")}</p>
      <ul className="bindings">
        {ACTIONS.map(({ action, label }) => {
          const code = bindings[action];
          const isCapturing = capturing === action;
          return (
            <li key={action} className="binding-row">
              <span className="binding-label">{t(label)}</span>
              <kbd className={`binding-key ${code ? "" : "binding-key--empty"} ${isCapturing ? "binding-key--capturing" : ""}`}>
                {isCapturing ? t("bindings.press") : code ? codeLabel(code) : t("bindings.unbound")}
              </kbd>
              <button
                className="button"
                aria-label={`${t("bindings.change")}: ${t(label)}`}
                onClick={() => {
                  setError(null);
                  setCapturing(isCapturing ? null : action);
                }}
              >
                {t("bindings.change")}
              </button>
              <button
                className="button button--ghost"
                aria-label={`${t("bindings.clear")}: ${t(label)}`}
                disabled={!code}
                onClick={() => settings.set({ bindings: withBinding(bindings, action, null) })}
              >
                {t("bindings.clear")}
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="dialog-error" role="alert">
          {t(ERROR_MESSAGES[error])}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button button--ghost"
          onClick={() => {
            setCapturing(null);
            setError(null);
            settings.set({ bindings: { ...DEFAULT_BINDINGS } });
          }}
        >
          {t("bindings.reset")}
        </button>
      </div>
    </Dialog>
  );
}
