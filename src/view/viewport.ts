/**
 * Compact (touch) layout maths: when the full keyboard is too small for
 * fingers, show a window of it at finger size and let the user move the window.
 * All units are white keys unless noted. Pure functions, no DOM.
 */

/** Below this key width (CSS px) a full keyboard is too small for fingers. */
export const MIN_FINGER_KEY = 32;

/** About two octaves: how many white keys the compact window aims to show. */
export const COMPACT_TARGET_KEYS = 15;

/** Key width the full-keyboard layout would get (mirrors the CSS fit in styles.css). */
export function fullFitKeyWidth(viewportWidth: number, stageHeight: number, whiteCount: number): number {
  return Math.min((viewportWidth - 72) / whiteCount, (stageHeight - 134) / 10.5, 58);
}

/** Compact mode: a touch device whose full keyboard would have keys too narrow for fingers. */
export function shouldUseCompact(coarsePointer: boolean, viewportWidth: number, stageHeight: number, whiteCount: number): boolean {
  return coarsePointer && fullFitKeyWidth(viewportWidth, stageHeight, whiteCount) < MIN_FINGER_KEY;
}

/** Keep the window inside the keyboard. */
export function clampScroll(scroll: number, visible: number, total: number): number {
  return Math.max(0, Math.min(Math.max(0, total - visible), scroll));
}

/** Centre the window on a point of the mini keyboard (0 = left edge, 1 = right edge). */
export function scrollForPointer(fraction: number, visible: number, total: number): number {
  return clampScroll(fraction * total - visible / 2, visible, total);
}

/**
 * Starting window: begin at C3 (white key 14 when the board starts at C1), the
 * computer keyboard's home, nudged left if the window is wider than two octaves.
 */
export function defaultScroll(visible: number, total: number, homeWhite = 14): number {
  return clampScroll(homeWhite - Math.max(0, (visible - COMPACT_TARGET_KEYS) / 2), visible, total);
}
