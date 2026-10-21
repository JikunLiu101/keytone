/** MIDI note number helpers. MIDI 60 is C4 (middle C). */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(midi % 12);
}

/** C3: the note played by `Z` when no octave key is held. */
export const BASE_MIDI = 48;

/** Momentary octave keys can shift by at most this many octaves either way. */
export const MAX_OCTAVE_SHIFT = 2;

/** Highest semitone offset (from BASE_MIDI) reachable by a note key: `/` = E4. */
export const MAX_KEY_SEMITONE = 16;

/** Lowest playable note: `Z` with −2 octaves = C1. */
export const RANGE_LOW = BASE_MIDI - 12 * MAX_OCTAVE_SHIFT;

/** Highest playable note: `/` with +2 octaves = E6. */
export const RANGE_HIGH = BASE_MIDI + MAX_KEY_SEMITONE + 12 * MAX_OCTAVE_SHIFT;
