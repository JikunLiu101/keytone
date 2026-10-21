import type { KeyboardController } from "../core/keyboard-controller";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
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
    if (!options.isEnabled() || isTyping(e.target)) return;
    // Leave browser and OS shortcuts (Ctrl+R, Alt+Tab, Cmd+…) alone.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    options.onGesture();
    if (controller.keyDown(e.code, e.repeat)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
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
