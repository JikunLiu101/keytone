import type { KeyboardController } from "../core/keyboard-controller";

/** Input types that take typed text; sliders, checkboxes and buttons do not. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/** True when the key press is meant for a text field, not the instrument. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

export interface KeyboardInputOptions {
  /** Called on every key press, so audio can be unlocked by the gesture. */
  onGesture: () => void;
  /** When false (e.g. a dialog is open) keys are not played. */
  isEnabled: () => boolean;
}

/**
 * Connect browser keyboard events to the controller. Returns a cleanup function.
 */
export function attachKeyboardInput(controller: KeyboardController, options: KeyboardInputOptions): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    controller.syncShift(e.shiftKey, e.code);
    if (!options.isEnabled() || isTyping(e.target)) return;
    // Leave browser and OS shortcuts (Ctrl+R, Alt+Tab, Cmd+…) alone.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    options.onGesture();
    // preventDefault also stops Space from clicking a focused button or toggle.
    if (controller.keyDown(e.code, e.repeat)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    controller.syncShift(e.shiftKey, e.code);
    if (controller.keyUp(e.code)) e.preventDefault();
  };
  const onBlur = () => controller.reset();
  const onVisibility = () => {
    if (document.hidden) controller.reset();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
