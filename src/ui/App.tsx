import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine, keyboard, keyboardWindow, layoutOverride, pointers, scorePage, settings } from "../app/services";
import { shouldUseCompact } from "../view/viewport";
import { codeLabel } from "../core/keymap";
import { attachKeyboardInput, isTyping } from "../input/keyboard-input";
import { backspaceHold, sendScoreCommand, songSwitch, type ScoreCommand } from "../app/commands";
import { SCORE_VIEWS } from "../app/settings";
import { stepInstrument } from "../audio/instruments";
import { RESTART_HOLD_MS } from "../core/shortcuts";
import { listScores } from "../score/library";
import { HoldRing } from "./HoldRing";
import { useSettings, useT } from "../i18n/useT";
import { BindingsDialog } from "./BindingsDialog";
import { ControlPanel } from "./ControlPanel";
import { CreditsDialog } from "./CreditsDialog";
import { KeyboardNav } from "./KeyboardNav";
import { KeyboardView, layout } from "./KeyboardView";
import { ScoreEditor } from "./ScoreEditor";
import { ToastHost, showToast } from "./Toast";


type DialogName = "bindings" | "credits" | "editor" | null;

export function App() {
  const t = useT();
  const { bindings, panelCollapsed: settingsCollapsed, scoreView } = useSettings();
  const [dialog, setDialog] = useState<DialogName>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
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

  // PageUp / PageDown turn the jianpu sheet's pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "PageUp" && e.code !== "PageDown") return;
      if (dialogRef.current || settings.get().scoreView !== "jianpu") return;
      const { page, count } = scorePage.get();
      const next = Math.min(count - 1, Math.max(0, page + (e.code === "PageDown" ? 1 : -1)));
      e.preventDefault();
      if (next !== page) scorePage.set({ page: next });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fixed shortcuts (core/shortcuts.ts). They only act while playing: not in
  // dialogs or the editor, not while typing, and not on keys a control focused
  // from the keyboard uses itself (Enter, Tab, arrows).
  useEffect(() => {
    let holdTimer = 0;
    let holdFired = false;
    let lastSwitch = 0;
    const CONTROL_KEYS = new Set(["Enter", "NumpadEnter", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    const keyboardFocus = () => {
      const a = document.activeElement;
      return a instanceof HTMLElement && a !== document.body && a.matches(":focus-visible");
    };

    const onDown = (e: KeyboardEvent) => {
      if (dialogRef.current || isTyping(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      if (CONTROL_KEYS.has(e.code) && keyboardFocus()) return;
      const s = settings.get();
      const falling = s.scoreView === "falling";
      const scoreOn = s.scoreView !== "off";
      const send = (command: ScoreCommand) => {
        e.preventDefault();
        sendScoreCommand(command);
      };
      switch (e.code) {
        case "Backspace": {
          if (!scoreOn || !(s.practice || falling)) return;
          e.preventDefault();
          if (e.repeat || holdTimer) return;
          holdFired = false;
          backspaceHold.set({ since: performance.now() });
          holdTimer = window.setTimeout(() => {
            holdFired = true;
            holdTimer = 0;
            backspaceHold.set({ since: null });
            sendScoreCommand("restart");
          }, RESTART_HOLD_MS);
          return;
        }
        case "ArrowLeft":
        case "ArrowRight":
          if (scoreOn && s.practice) send(e.code === "ArrowLeft" ? "stepBack" : "stepForward");
          return;
        case "Enter":
        case "NumpadEnter":
          // Falling notes: play / pause. Jianpu practice: play again once complete.
          if (falling || (scoreOn && s.practice)) send("playPause");
          return;
        case "ArrowUp":
        case "ArrowDown":
          if (falling) send(e.code === "ArrowUp" ? "speedUp" : "speedDown");
          return;
        case "KeyR":
          if (falling) send("toggleLoop");
          return;
        case "Escape":
          if (falling) sendScoreCommand("pause");
          return;
        case "KeyP":
          if (!scoreOn) return;
          settings.set({ practice: !s.practice });
          showToast(t(s.practice ? "toast.practiceOff" : "toast.practiceOn"));
          return;
        case "Backquote": {
          e.preventDefault();
          const next = SCORE_VIEWS[(SCORE_VIEWS.indexOf(s.scoreView) + 1) % SCORE_VIEWS.length];
          settings.set({ scoreView: next });
          showToast(t("toast.view").replace("{v}", t(`score.view.${next}`)));
          return;
        }
        case "Tab": {
          e.preventDefault();
          const list = listScores(s.language);
          if (!list.length) return;
          // Repeated presses step on from the song already on its way in.
          const pending = songSwitch.get().target;
          const from = pending && performance.now() - lastSwitch < 2000 ? pending : s.scoreId;
          const i = Math.max(0, list.findIndex((x) => x.id === from));
          const target = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
          lastSwitch = performance.now();
          // The dropdown animates the change when it is on screen; otherwise switch and say so.
          if (s.panelCollapsed || keyboardWindow.get().compact || !scoreOn) {
            settings.set({ scoreId: target.id });
            showToast(t("toast.song").replace("{title}", target.title));
            songSwitch.set({ target: null });
          } else {
            songSwitch.set({ target: target.id, token: songSwitch.get().token + 1 });
          }
          return;
        }
        case "BracketLeft":
        case "BracketRight": {
          const next = stepInstrument(s.instrumentId, e.code === "BracketLeft" ? -1 : 1);
          engine.unlock();
          settings.set({ instrumentId: next.id });
          showToast(t(next.nameKey));
          return;
        }
        case "Minus":
        case "Equal": {
          const volume = Math.round(Math.max(0, Math.min(1, s.volume + (e.code === "Minus" ? -0.05 : 0.05))) * 100) / 100;
          settings.set({ volume });
          showToast(t("toast.volume").replace("{n}", String(Math.round(volume * 100))));
          return;
        }
        case "KeyE":
          if (!keyboardWindow.get().compact) setDialog("editor");
          return;
        case "F1":
          e.preventDefault();
          setDialog("bindings");
          return;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Backspace" || (!holdTimer && !holdFired)) return;
      // A short press (released before the hold finished) goes back one phrase.
      if (holdTimer) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
        backspaceHold.set({ since: null });
        sendScoreCommand("phraseBack");
      }
      holdFired = false;
    };
    const cancelHold = () => {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
      backspaceHold.set({ since: null });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", cancelHold);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", cancelHold);
      cancelHold();
    };
  }, [t]);

  // Switching layout or opening/closing the panel moves the stage; re-measure
  // right away instead of waiting for the next resize notification.
  useLayoutEffect(() => updateStage.current(), [compact, settingsCollapsed, scoreView]);

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
    <div className="app" data-compact={compact || undefined} data-score-view={scoreView}>
      <ControlPanel
        onOpenBindings={() => setDialog("bindings")}
        onOpenCredits={() => setDialog("credits")}
        onOpenEditor={() => setDialog("editor")}
      />

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
        <ToastHost />
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
      {dialog === "editor" && <ScoreEditor onClose={closeDialog} />}
      <HoldRing />
    </div>
  );
}
