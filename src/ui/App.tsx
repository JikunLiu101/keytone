import { useEffect, useRef, useState } from "react";
import { engine, keyboard } from "../app/services";
import { codeLabel } from "../core/keymap";
import { attachKeyboardInput } from "../input/keyboard-input";
import { useSettings, useT } from "../i18n/useT";
import { BindingsDialog } from "./BindingsDialog";
import { ControlPanel } from "./ControlPanel";
import { CreditsDialog } from "./CreditsDialog";
import { EffectsLayer } from "./EffectsLayer";
import { KeyboardView } from "./KeyboardView";

type DialogName = "bindings" | "credits" | null;

export function App() {
  const t = useT();
  const { bindings } = useSettings();
  const [dialog, setDialog] = useState<DialogName>(null);
  const dialogRef = useRef<DialogName>(null);
  dialogRef.current = dialog;

  useEffect(
    () =>
      attachKeyboardInput(keyboard, {
        onGesture: () => engine.unlock(),
        isEnabled: () => dialogRef.current === null,
      }),
    [],
  );

  // Opening a dialog stops anything still held.
  useEffect(() => {
    if (dialog) keyboard.reset();
  }, [dialog]);

  const key = (code: string | null) => (code ? <kbd>{codeLabel(code)}</kbd> : null);

  return (
    <div className="app">
      <ControlPanel onOpenBindings={() => setDialog("bindings")} onOpenCredits={() => setDialog("credits")} />

      <main className="main">
        <EffectsLayer />
        <KeyboardView />
        <p className="hint">
          {t("hint.play")} <kbd>Z</kbd>–<kbd>/</kbd> · <kbd>S</kbd> <kbd>D</kbd> <kbd>G</kbd> <kbd>H</kbd>{" "}
          <kbd>J</kbd> <kbd>L</kbd> <kbd>;</kbd>
          {(bindings.octaveDown1 || bindings.octaveUp1) && (
            <>
              {" · "}
              {key(bindings.octaveDown1)} {key(bindings.octaveUp1)} {t("hint.octave")}
            </>
          )}
          {bindings.sustain && (
            <>
              {" · "}
              {key(bindings.sustain)} {t("hint.sustain")}
            </>
          )}
          {" · "}
          {t("hint.mouse")}
        </p>
      </main>

      {dialog === "bindings" && <BindingsDialog onClose={() => setDialog(null)} />}
      {dialog === "credits" && <CreditsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
