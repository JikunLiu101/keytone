/** MIDI note number helpers. MIDI 60 is C4 (middle C). */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(midi % 12);
}

/**
 * C3: the base scores are written at. A score's pitches, the editor's range
 * check and key hints are worked out at this base; the base octave that
 * applies (spec §13) shifts what actually sounds.
 */
export const BASE_MIDI = 48;

/** Octave numbers of the base C the player can choose (spec §13.2). */
export const BASE_OCTAVES = [2, 3, 4, 5] as const;

/** C4: the base when none was chosen. */
export const DEFAULT_BASE_OCTAVE = 4;

/** MIDI note of the C in `octave`: C4 = 60. */
export function octaveC(octave: number): number {
  return 12 * (octave + 1);
}

/** Momentary octave keys can shift by at most this many octaves either way. */
export const MAX_OCTAVE_SHIFT = 2;

/** Highest semitone offset (from BASE_MIDI) reachable by a note key: `/` = E4. */
export const MAX_KEY_SEMITONE = 16;

/**
 * The notes the keys reach from base C `base`: `Z` two octaves down to `/`
 * two octaves up, 65 keys, not cut to the piano's A0–C8 (spec §13.2).
 */
export function playableRange(base: number): { low: number; high: number } {
  return { low: base - 12 * MAX_OCTAVE_SHIFT, high: base + MAX_KEY_SEMITONE + 12 * MAX_OCTAVE_SHIFT };
}

/** The playable range at base C `base`, for messages: "C2–E7" at C4. */
export function rangeLabel(base: number): string {
  const { low, high } = playableRange(base);
  return `${noteName(low)}–${noteName(high)}`;
}

/** Lowest written note: `Z` with −2 octaves at the written base = C1. */
export const RANGE_LOW = playableRange(BASE_MIDI).low;

/** Highest written note: `/` with +2 octaves at the written base = E6. */
export const RANGE_HIGH = playableRange(BASE_MIDI).high;
