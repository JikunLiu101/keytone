/**
 * Fixed keyboard shortcuts (not rebindable). Listed in the key bindings
 * dialog and kept out of the octave/sustain keys a user can choose.
 */
import type { MessageKey } from "../i18n/strings";

export interface Shortcut {
  /** Keys as shown to the user, e.g. ["Shift", "Tab"]. */
  keys: string[];
  label: MessageKey;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: ["Backspace"], label: "sc.phraseBack" },
  { keys: ["Backspace (1s)"], label: "sc.restart" },
  { keys: ["←", "→"], label: "sc.step" },
  { keys: ["Enter"], label: "sc.playPause" },
  { keys: ["↑", "↓"], label: "sc.speed" },
  { keys: ["R"], label: "sc.loop" },
  { keys: ["P"], label: "sc.practice" },
  { keys: ["`"], label: "sc.view" },
  { keys: ["Tab"], label: "sc.nextSong" },
  { keys: ["Shift", "Tab"], label: "sc.prevSong" },
  { keys: ["PageUp", "PageDown"], label: "sc.page" },
  { keys: ["[", "]"], label: "sc.instrument" },
  { keys: ["-", "="], label: "sc.volume" },
  { keys: ["E"], label: "sc.editor" },
  { keys: ["Ctrl", "S"], label: "sc.save" },
  { keys: ["Esc"], label: "sc.escape" },
  { keys: ["F1"], label: "sc.help" },
];

/** `KeyboardEvent.code`s taken by shortcuts, so they can't be bound to octave or sustain. */
export const SHORTCUT_CODES: ReadonlySet<string> = new Set([
  "Backspace",
  "Enter",
  "NumpadEnter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyR",
  "KeyP",
  "KeyE",
  "Backquote",
  "Tab",
  "PageUp",
  "PageDown",
  "BracketLeft",
  "BracketRight",
  "Minus",
  "Equal",
]);

/** How long Backspace must be held to restart the whole score. */
export const RESTART_HOLD_MS = 1000;
