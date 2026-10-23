/**
 * Score model and its text format (see docs/spec.md §10.5).
 *
 * Durations are measured in beats, and a beat is always a quarter note, so a
 * 6/8 bar holds 3 beats (six eighths written with `/`). Tempo is quarter
 * notes per minute.
 */
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";

/** Key names allowed in `key:`. Index in this list = semitones above C. */
export const KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export type KeyName = (typeof KEY_NAMES)[number];
/** Enharmonic spellings accepted when reading. */
const KEY_ALIASES: Record<string, KeyName> = { "C#": "Db", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };

export const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const TEMPO_MIN = 30;
export const TEMPO_MAX = 240;

/** Scale degree → semitones above the tonic (major scale). */
const DEGREE_SEMITONES = [0, 0, 2, 4, 5, 7, 9, 11];

export interface Pitch {
  /** Scale degree 1–7. */
  degree: number;
  /** Octave dots: positive = above, negative = below. */
  octave: number;
  /** −1 flat, 0 natural, +1 sharp. */
  accidental: number;
}

export interface ScoreEvent {
  /** A note, a rest (`0`) or a chord (`[1 3 5]`). */
  kind: "note" | "rest" | "chord";
  /** One pitch for a note, several for a chord, none for a rest. */
  pitches: Pitch[];
  /** Number of `/`: 0 = one beat, 1 = half, 2 = quarter. */
  halvings: number;
  dotted: boolean;
  /** Number of `-` after it, each adding one beat. */
  extensions: number;
}

export interface Score {
  title: string;
  key: KeyName;
  time: TimeSignature;
  tempo: number;
  /** Beats before the first full bar (an upbeat). */
  pickup: number;
  events: ScoreEvent[];
}

export type ParseErrorCode =
  | "badKey"
  | "badTime"
  | "badTempo"
  | "badPickup"
  | "badHeader"
  | "dashFirst"
  | "unexpected"
  | "chordUnclosed"
  | "outOfRange";

export interface ParseError {
  /** 1-based line in the source text (0 when it applies to the whole score). */
  line: number;
  code: ParseErrorCode;
  /** The text that caused it, if any. */
  detail?: string;
  /** English description, for logs and tests. */
  message: string;
}

function error(line: number, code: ParseErrorCode, message: string, detail?: string): ParseError {
  return { line, code, message, detail };
}

export interface ParseResult {
  score: Score;
  errors: ParseError[];
}

export function emptyScore(title = ""): Score {
  return { title, key: "C", time: "4/4", tempo: 100, pickup: 0, events: [] };
}

/** Length of one event in beats. */
export function eventBeats(e: ScoreEvent): number {
  const base = 1 / 2 ** e.halvings;
  return base * (e.dotted ? 1.5 : 1) + e.extensions;
}

/** Beats in one bar. */
export function barBeats(time: TimeSignature): number {
  const [n, d] = time.split("/").map(Number);
  return (n * 4) / d;
}

/** MIDI note of the key's tonic (1) without octave dots: 1=C is C3, the `Z` key. */
export function tonicMidi(key: KeyName): number {
  return 48 + KEY_NAMES.indexOf(key);
}

export function pitchMidi(p: Pitch, key: KeyName): number {
  return tonicMidi(key) + DEGREE_SEMITONES[p.degree] + p.accidental + 12 * p.octave;
}

export function inRange(midi: number): boolean {
  return midi >= RANGE_LOW && midi <= RANGE_HIGH;
}

/** Total length in beats. */
export function scoreBeats(score: Score): number {
  return score.events.reduce((sum, e) => sum + eventBeats(e), 0);
}

// ---------- Reading ----------

function readHeader(score: Score, name: string, value: string, line: number, errors: ParseError[]): void {
  switch (name) {
    case "title":
      score.title = value;
      return;
    case "key": {
      const key = (KEY_ALIASES[value] ?? value) as KeyName;
      if (KEY_NAMES.includes(key)) score.key = key;
      else errors.push(error(line, "badKey", `Unknown key "${value}"`, value));
      return;
    }
    case "time":
      if (TIME_SIGNATURES.includes(value as TimeSignature)) score.time = value as TimeSignature;
      else errors.push(error(line, "badTime", `Unsupported time signature "${value}"`, value));
      return;
    case "tempo": {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) score.tempo = Math.round(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, n)));
      else errors.push(error(line, "badTempo", `Bad tempo "${value}"`, value));
      return;
    }
    case "pickup": {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) score.pickup = n;
      else errors.push(error(line, "badPickup", `Bad pickup "${value}"`, value));
      return;
    }
    default:
      // Unknown headers (for example a future `lyrics:`) are ignored, not errors.
      return;
  }
}

/** Parse the notes part of a score. */
function readBody(text: string, firstLine: number, errors: ParseError[]): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  let i = 0;
  let line = firstLine;
  const peek = () => text[i];

  const readPitch = (): Pitch | null => {
    let accidental = 0;
    if (peek() === "#") {
      accidental = 1;
      i++;
    } else if (peek() === "b") {
      accidental = -1;
      i++;
    }
    const c = peek();
    if (!c || c < "1" || c > "7") return null;
    i++;
    let octave = 0;
    while (peek() === "'" || peek() === ",") {
      octave += peek() === "'" ? 1 : -1;
      i++;
    }
    return { degree: Number(c), octave, accidental };
  };

  const readDuration = (e: ScoreEvent) => {
    while (peek() === "/" || peek() === ".") {
      if (peek() === "/") e.halvings = Math.min(2, e.halvings + 1);
      else e.dotted = true;
      i++;
    }
  };

  while (i < text.length) {
    const c = peek();
    if (c === "\n") {
      line++;
      i++;
    } else if (c === " " || c === "\t" || c === "\r" || c === "|") {
      i++;
    } else if (c === "-") {
      i++;
      const last = events[events.length - 1];
      if (last) last.extensions++;
      else errors.push(error(line, "dashFirst", `"-" needs a note before it`));
    } else if (c === "0") {
      i++;
      const e: ScoreEvent = { kind: "rest", pitches: [], halvings: 0, dotted: false, extensions: 0 };
      readDuration(e);
      events.push(e);
    } else if (c === "[") {
      i++;
      const pitches: Pitch[] = [];
      while (i < text.length && peek() !== "]") {
        if (peek() === " ") {
          i++;
          continue;
        }
        const p = readPitch();
        if (p) pitches.push(p);
        else {
          errors.push(error(line, "unexpected", `Unexpected "${peek()}" in chord`, peek()));
          i++;
        }
      }
      if (peek() === "]") i++;
      else errors.push(error(line, "chordUnclosed", `Chord is missing "]"`));
      const e: ScoreEvent = {
        kind: pitches.length === 1 ? "note" : "chord",
        pitches,
        halvings: 0,
        dotted: false,
        extensions: 0,
      };
      readDuration(e);
      if (pitches.length) events.push(e);
    } else {
      const start = i;
      const p = readPitch();
      if (p) {
        const e: ScoreEvent = { kind: "note", pitches: [p], halvings: 0, dotted: false, extensions: 0 };
        readDuration(e);
        events.push(e);
      } else {
        i = start + 1;
        errors.push(error(line, "unexpected", `Unexpected "${c}"`, c));
      }
    }
  }
  return events;
}

/**
 * Read a score from text. Never throws: anything it can't understand is
 * reported in `errors` and skipped.
 */
export function parseScore(text: string): ParseResult {
  const score = emptyScore();
  const errors: ParseError[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const separator = lines.findIndex((l) => l.trim() === "---");
  let bodyStart = 0;
  if (separator >= 0) {
    for (let n = 0; n < separator; n++) {
      const m = /^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/.exec(lines[n]);
      if (m) readHeader(score, m[1].toLowerCase(), m[2], n + 1, errors);
      else if (lines[n].trim()) errors.push(error(n + 1, "badHeader", `Expected "name: value"`, lines[n].trim()));
    }
    bodyStart = separator + 1;
  }
  score.events = readBody(lines.slice(bodyStart).join("\n"), bodyStart + 1, errors);
  for (const e of score.events) {
    if (e.pitches.some((p) => !inRange(pitchMidi(p, score.key)))) {
      errors.push(error(0, "outOfRange", "Some notes are outside the keyboard's range"));
      break;
    }
  }
  return { score, errors };
}

// ---------- Writing ----------

function writePitch(p: Pitch): string {
  const acc = p.accidental > 0 ? "#" : p.accidental < 0 ? "b" : "";
  const marks = p.octave > 0 ? "'".repeat(p.octave) : ",".repeat(-p.octave);
  return `${acc}${p.degree}${marks}`;
}

function writeEvent(e: ScoreEvent): string {
  const head =
    e.kind === "rest" ? "0" : e.kind === "chord" ? `[${e.pitches.map(writePitch).join(" ")}]` : writePitch(e.pitches[0]);
  const duration = (e.dotted ? "." : "") + "/".repeat(e.halvings);
  return head + duration + " -".repeat(e.extensions);
}

/** Write a score as text, one line per `barsPerLine` bars. */
export function serializeScore(score: Score, barsPerLine = 4): string {
  const header = [`title: ${score.title}`, `key: ${score.key}`, `time: ${score.time}`, `tempo: ${score.tempo}`];
  if (score.pickup > 0) header.push(`pickup: ${score.pickup}`);
  const bar = barBeats(score.time);
  const out: string[] = [];
  let current: string[] = [];
  let lineBars = 0;
  // Beats left before the next bar line.
  let left = score.pickup > 0 ? score.pickup : bar;
  const closeBar = () => {
    current.push("|");
    lineBars++;
    if (lineBars >= barsPerLine) {
      out.push(current.join(" "));
      current = [];
      lineBars = 0;
    }
  };
  for (const e of score.events) {
    current.push(writeEvent(e));
    left -= eventBeats(e);
    while (left <= 1e-9) {
      closeBar();
      left += bar;
    }
  }
  if (current.length) out.push(current.join(" "));
  return `${header.join("\n")}\n---\n${out.join("\n")}\n`;
}
