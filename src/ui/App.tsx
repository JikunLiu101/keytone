import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine, keyboard, keyboardWindow, layoutOverride, pointers } from "../app/services";
import { shouldUseCompact } from "../view/viewport";
import { codeLabel } from "../core/keymap";
import { attachKeyboardInput } from "../input/keyboard-input";
import { useSettings, useT } from "../i18n/useT";
import { BindingsDialog } from "./BindingsDialog";
import { ControlPanel } from "./ControlPanel";
import { CreditsDialog } from "./CreditsDialog";
import { KeyboardNav } from "./KeyboardNav";
import { KeyboardView, layout } from "./KeyboardView";

type DialogName = "bindings" | "credits" | null;

export function App() {
  const t = useT();
  const { bindings, panelCollapsed: settingsCollapsed } = useSettings();
  const [dialog, setDialog] = useState<DialogName>(null);
  const dialogRef = useRef<DialogName>(null);
  dialogRef.current = dialog;
  const mainRef = useRef<HTMLElement>(null);
  const { compact, visible } = useSyncExternalStore(keyboardWindow.subscribe, keyboardWindow.get);

  // Expose the stage's height to CSS (--main-h) so the keyboard can size by
  // height as well as width, and the glass can grow into the free space.
  // Also decide between the full keyboard and the compact touch layout.
  const updateStage = useRef(() => {});
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => {
      // Content height: the compact layout reserves a top inset for the floating panel bar.
      const height = Math.round(main.clientHeight - parseFloat(getComputedStyle(main).paddingTop || "0"));
      main.style.setProperty("--main-h", `${height}px`);
      const compactNow =
        layoutOverride === "compact" ||
        (layoutOverride !== "full" && shouldUseCompact(coarse.matches, innerWidth, height, layout.whiteCount));
      const current = keyboardWindow.get();
      if (compactNow !== current.compact || height !== current.stageHeight) {
        keyboardWindow.set({ compact: compactNow, stageHeight: height });
      }
    };
    updateStage.current = update;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(main);
    coarse.addEventListener("change", update);
    return () => {
      observer.disconnect();
      coarse.removeEventListener("change", update);
    };
  }, []);

  useEffect(
    () =>
      attachKeyboardInput(keyboard, {
        onGesture: () => engine.unlock(),
        isEnabled: () => dialogRef.current === null,
      }),
    [],
  );

  // Switching layout or opening/closing the panel moves the stage; re-measure
  // right away instead of waiting for the next resize notification.
  useLayoutEffect(() => updateStage.current(), [compact, settingsCollapsed]);

  // Mobile browsers only start audio inside certain gestures (touchend,
  // click); try on each until it works. Release fingers if the page loses
  // focus or is hidden mid-touch (a call, app switch).
  useEffect(() => {
    const unlock = () => engine.unlock();
    // Chrome counts pointerup/touchend (not a touch pointerdown) as activation.
    const gestures = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    for (const g of gestures) window.addEventListener(g, unlock, { capture: true, passive: true });
    const release = () => pointers.cancelAll();
    const onVisibility = () => document.hidden && release();
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const g of gestures) window.removeEventListener(g, unlock, { capture: true });
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Opening a dialog stops anything still held.
  useEffect(() => {
    if (dialog) {
      keyboard.reset();
      pointers.cancelAll();
    }
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
    <div className="app" data-compact={compact || undefined}>
      <ControlPanel onOpenBindings={() => setDialog("bindings")} onOpenCredits={() => setDialog("credits")} />

      <main className="main" ref={mainRef}>
        {compact && visible < layout.whiteCount && <KeyboardNav layout={layout} />}
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

      <div className="rotate-prompt" role="alert">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="18" y="6" width="20" height="34" rx="3" />
          <path d="M8 44c6 6 18 8 28 4" strokeLinecap="round" />
          <path d="M33 44l4 4-5 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="rotate-title">{t("rotate.title")}</p>
        <p className="rotate-body">{t("rotate.body")}</p>
      </div>

      {dialog === "bindings" && <BindingsDialog onClose={() => setDialog(null)} />}
      {dialog === "credits" && <CreditsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
