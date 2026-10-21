import { useEffect, useRef, useState } from "react";
import { engine, keyboard } from "../app/services";
import { codeLabel } from "../core/keymap";
import { attachKeyboardInput } from "../input/keyboard-input";
import { useSettings, useT } from "../i18n/useT";
import { BindingsDialog } from "./BindingsDialog";
import { ControlPanel } from "./ControlPanel";
import { CreditsDialog } from "./CreditsDialog";
import { KeyboardView } from "./KeyboardView";

type DialogName = "bindings" | "credits" | null;

export function App() {
  const t = useT();
  const { bindings } = useSettings();
  const [dialog, setDialog] = useState<DialogName>(null);
  const dialogRef = useRef<DialogName>(null);
  dialogRef.current = dialog;
  const mainRef = useRef<HTMLElement>(null);

  // Expose the stage's height to CSS (--main-h) so the keyboard can size by
  // height as well as width, and the glass can grow into the free space.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const observer = new ResizeObserver(([entry]) => {
      main.style.setProperty("--main-h", `${Math.round(entry.contentRect.height)}px`);
    });
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

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

  /** "Hold {key} for {action}" with the key rendered as a <kbd>. */
  const hold = (code: string | null, action: string) => {
    if (!code) return null;
    const [before, after] = t("hint.hold").replace("{action}", action).split("{key}");
    return (
      <>
        {" · "}
        {before}
        <kbd>{codeLabel(code)}</kbd>
        {after}
      </>
    );
  };

  return (
    <div className="app">
      <ControlPanel onOpenBindings={() => setDialog("bindings")} onOpenCredits={() => setDialog("credits")} />

      <main className="main" ref={mainRef}>
        <KeyboardView />
        <p className="hint">
          {t("hint.play")} <kbd>Z</kbd>–<kbd>/</kbd> · <kbd>S</kbd> <kbd>D</kbd> <kbd>G</kbd> <kbd>H</kbd>{" "}
          <kbd>J</kbd> <kbd>L</kbd> <kbd>;</kbd>
          {hold(bindings.octaveDown1, t("bindings.octaveDown1"))}
          {hold(bindings.octaveUp1, t("bindings.octaveUp1"))}
          {hold(bindings.sustain, t("hint.sustain"))}
          {" · "}
          {t("hint.mouse")}
        </p>
      </main>

      {dialog === "bindings" && <BindingsDialog onClose={() => setDialog(null)} />}
      {dialog === "credits" && <CreditsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
