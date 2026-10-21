import type { KeyboardController } from "../core/keyboard-controller";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Connect browser keyboard events to the controller. Returns a cleanup function.
 */
export function attachKeyboardInput(controller: KeyboardController, onGesture: () => void): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    // Leave browser and OS shortcuts (Ctrl+R, Alt+Tab, Cmd+…) alone.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    onGesture();
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
