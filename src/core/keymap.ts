/**
 * Computer-keyboard mapping. Keys are identified by `KeyboardEvent.code`
 * (physical position), so the layout works the same on QWERTY, AZERTY, etc.
 */

/** Fixed note keys → semitone offset from the current octave's C. */
export const NOTE_KEYS: Readonly<Record<string, number>> = {
  KeyZ: 0, // C
  KeyS: 1, // C#
  KeyX: 2, // D
  KeyD: 3, // D#
  KeyC: 4, // E
  KeyV: 5, // F
  KeyG: 6, // F#
  KeyB: 7, // G
  KeyH: 8, // G#
  KeyN: 9, // A
  KeyJ: 10, // A#
  KeyM: 11, // B
  Comma: 12, // C (next octave)
  KeyL: 13, // C#
  Period: 14, // D
  Semicolon: 15, // D#
  Slash: 16, // E
};

/** Actions that can be bound to a key by the user. */
export type BindableAction = "octaveDown1" | "octaveUp1" | "octaveDown2" | "octaveUp2" | "sustain";

/** Action → `KeyboardEvent.code`, or null when unbound. */
export type KeyBindings = Record<BindableAction, string | null>;

export const DEFAULT_BINDINGS: Readonly<KeyBindings> = {
  octaveDown1: "ShiftLeft",
  octaveUp1: "ShiftRight",
  octaveDown2: null,
  octaveUp2: null,
  sustain: "Space",
};

/** Octave shift contributed by each octave action while it is held. */
export const OCTAVE_ACTION_SHIFT: Readonly<Record<Exclude<BindableAction, "sustain">, number>> = {
  octaveDown1: -1,
  octaveUp1: 1,
  octaveDown2: -2,
  octaveUp2: 2,
};

/** Find which action (if any) a key code is bound to. */
export function actionForCode(bindings: KeyBindings, code: string): BindableAction | null {
  for (const action of Object.keys(bindings) as BindableAction[]) {
    if (bindings[action] === code) return action;
  }
  return null;
}

const CODE_LABELS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Space: "Space",
  ShiftLeft: "L Shift",
  ShiftRight: "R Shift",
};

/** Short human-readable label for a key code, e.g. "KeyZ" → "Z". */
export function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}
