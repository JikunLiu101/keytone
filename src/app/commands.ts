/**
 * Shortcut commands. The global key handler sends them; whichever score view
 * is on screen (sheet or falling notes) acts on the ones it understands.
 */
import { createStore } from "../core/store";

export type ScoreCommand =
  | "phraseBack"
  | "restart"
  | "stepBack"
  | "stepForward"
  | "playPause"
  | "pause"
  | "speedUp"
  | "speedDown"
  | "toggleLoop";

type Listener = (command: ScoreCommand) => void;
const listeners = new Set<Listener>();

export function sendScoreCommand(command: ScoreCommand): void {
  for (const l of listeners) l(command);
}

export function onScoreCommand(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Backspace being held: when it started (ms), or null. Drives the hold ring. */
export const backspaceHold = createStore<{ since: number | null }>({ since: null });

/**
 * Tab / Shift+Tab song switch. The score dropdown animates to `target` and
 * commits it; `token` changes on every request so repeats are seen.
 */
export const songSwitch = createStore<{ target: string | null; token: number }>({ target: null, token: 0 });
