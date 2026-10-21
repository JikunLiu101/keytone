import { NoteHub } from "./note-hub";
import {
  NOTE_KEYS,
  OCTAVE_ACTION_SHIFT,
  actionForCode,
  type BindableAction,
  type KeyBindings,
} from "./keymap";
import { BASE_MIDI, MAX_OCTAVE_SHIFT, RANGE_HIGH, RANGE_LOW } from "./notes";

type OctaveAction = Exclude<BindableAction, "sustain">;

export interface KeyboardControllerOptions {
  getBindings: () => KeyBindings;
  getVelocity: () => number;
}

/**
 * Turns computer-key presses into NoteHub calls. Pure logic with no DOM, so
 * it is driven by `keyDown(code)` / `keyUp(code)` and can be unit-tested.
 */
export class KeyboardController {
  /** Held note keys → the MIDI note they started (pitch is fixed at key-down). */
  private heldNotes = new Map<string, number>();
  /** Held octave keys → their action, kept so release still works if bindings change. */
  private heldOctaveKeys = new Map<string, OctaveAction>();
  private sustainKey: string | null = null;
  private listeners = new Set<() => void>();
  private shift = 0;

  constructor(
    private readonly hub: NoteHub,
    private readonly options: KeyboardControllerOptions,
  ) {}

  /** Current octave shift from held octave keys, clamped to ±MAX_OCTAVE_SHIFT. */
  getOctaveShift = (): number => this.shift;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Returns true when the key is handled (caller should preventDefault). */
  keyDown(code: string, repeat = false): boolean {
    const action = actionForCode(this.options.getBindings(), code);
    if (action) {
      if (repeat) return true;
      if (action === "sustain") {
        this.sustainKey = code;
        this.hub.setSustain(true);
      } else {
        this.heldOctaveKeys.set(code, action);
        this.updateShift();
      }
      return true;
    }

    const semitone = NOTE_KEYS[code];
    if (semitone === undefined) return false;
    if (repeat || this.heldNotes.has(code)) return true;

    const midi = BASE_MIDI + 12 * this.shift + semitone;
    if (midi < RANGE_LOW || midi > RANGE_HIGH) return true;
    this.heldNotes.set(code, midi);
    this.hub.press(sourceId(code), midi, this.options.getVelocity());
    return true;
  }

  keyUp(code: string): boolean {
    if (this.heldOctaveKeys.delete(code)) {
      this.updateShift();
      return true;
    }
    if (code === this.sustainKey) {
      this.sustainKey = null;
      this.hub.setSustain(false);
      return true;
    }
    const midi = this.heldNotes.get(code);
    if (midi === undefined) return NOTE_KEYS[code] !== undefined;
    this.heldNotes.delete(code);
    this.hub.release(sourceId(code), midi);
    return true;
  }

  /** Forget all held keys, e.g. when the window loses focus. */
  reset(): void {
    for (const [code, midi] of this.heldNotes) this.hub.release(sourceId(code), midi);
    this.heldNotes.clear();
    this.heldOctaveKeys.clear();
    if (this.sustainKey) this.hub.setSustain(false);
    this.sustainKey = null;
    this.updateShift();
  }

  private updateShift(): void {
    let sum = 0;
    for (const action of this.heldOctaveKeys.values()) sum += OCTAVE_ACTION_SHIFT[action];
    const next = Math.max(-MAX_OCTAVE_SHIFT, Math.min(MAX_OCTAVE_SHIFT, sum));
    if (next === this.shift) return;
    this.shift = next;
    for (const listener of this.listeners) listener();
  }
}

function sourceId(code: string): string {
  return `key:${code}`;
}
