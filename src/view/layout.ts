/**
 * Renderer-independent keyboard geometry. Units are white-key widths, so any
 * view (CSS today, Canvas or Three.js later) can scale it to its own space.
 */
import { NOTE_KEYS, codeLabel } from "../core/keymap";
import { BASE_MIDI, isBlackKey, noteName } from "../core/notes";

export interface KeyGeometry {
  midi: number;
  name: string;
  black: boolean;
  /** Left edge, in white-key widths from the left of the keyboard. */
  x: number;
  width: number;
}

export interface KeyboardLayout {
  keys: KeyGeometry[];
  whiteCount: number;
}

export const BLACK_KEY_WIDTH = 0.6;

/** Small offsets that make black keys sit like they do on a real keyboard. */
const BLACK_OFFSET: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 };

export function buildLayout(low: number, high: number): KeyboardLayout {
  const keys: KeyGeometry[] = [];
  let whiteIndex = 0;
  for (let midi = low; midi <= high; midi++) {
    const black = isBlackKey(midi);
    if (black) {
      const center = whiteIndex + (BLACK_OFFSET[midi % 12] ?? 0);
      keys.push({ midi, name: noteName(midi), black, x: center - BLACK_KEY_WIDTH / 2, width: BLACK_KEY_WIDTH });
    } else {
      keys.push({ midi, name: noteName(midi), black, x: whiteIndex, width: 1 });
      whiteIndex++;
    }
  }
  return { keys, whiteCount: whiteIndex };
}

/** midi → computer-key label for the given octave shift, e.g. 48 → "Z" at shift 0. */
export function computerKeyLabels(octaveShift: number): Map<number, string> {
  const labels = new Map<number, string>();
  const base = BASE_MIDI + 12 * octaveShift;
  for (const [code, semitone] of Object.entries(NOTE_KEYS)) {
    labels.set(base + semitone, codeLabel(code));
  }
  return labels;
}
