/**
 * Lays a score out as jianpu: glyphs grouped into beams, bars, lines and
 * pages. Pure data, so any renderer can draw it and it can be unit-tested.
 */
import { BASE_MIDI } from "../core/notes";
import { NOTE_KEYS } from "../core/keymap";
import { barBeats, pitchMidi, type Pitch, type Score } from "./score";

export interface Glyph {
  type: "note" | "rest" | "dash";
  /** Index of the score event this glyph belongs to. */
  event: number;
  /** Pitches drawn (empty for rests and dashes). */
  pitches: Pitch[];
  /** MIDI notes of the pitches. */
  midi: number[];
  /** Underlines under the glyph: 1 = eighth, 2 = sixteenth. */
  underlines: number;
  dotted: boolean;
}

export interface Bar {
  /** Glyphs grouped so the underlines of notes within one beat join up. */
  groups: Glyph[][];
}

export interface Line {
  bars: Bar[];
}

export interface JianpuLayout {
  /** Pages of lines. */
  pages: Line[][];
}

export interface SheetSize {
  /** Glyph slots that fit on one line (one slot ≈ one white key). */
  slotsPerLine: number;
  /** Lines that fit on one page. */
  linesPerPage: number;
}

/** A bar line and the space around it take about one slot. */
export const BAR_OVERHEAD = 1;

export function barGlyphs(bar: Bar): number {
  return bar.groups.reduce((n, g) => n + g.length, 0);
}

const EPS = 1e-9;

/** Split a score into bars of glyphs. */
export function layoutBars(score: Score): Bar[] {
  const barLength = barBeats(score.time);
  const bars: Bar[] = [];
  let groups: Glyph[][] = [];
  let pos = 0; // beats since the start of the current bar
  let length = score.pickup > 0 ? score.pickup : barLength;
  let beamBeat = -1; // the beat the last open beam group started in

  const place = (glyph: Glyph, beats: number) => {
    const beat = Math.floor(pos + EPS);
    const last = groups[groups.length - 1];
    if (glyph.underlines > 0 && last && beamBeat === beat && last[last.length - 1].underlines > 0) {
      last.push(glyph);
    } else {
      groups.push([glyph]);
      beamBeat = glyph.underlines > 0 ? beat : -1;
    }
    pos += beats;
    if (pos >= length - EPS) {
      bars.push({ groups });
      groups = [];
      pos = Math.max(0, pos - length);
      length = barLength;
      beamBeat = -1;
    }
  };

  score.events.forEach((e, index) => {
    const midi = e.pitches.map((p) => pitchMidi(p, score.key));
    const base = (1 / 2 ** e.halvings) * (e.dotted ? 1.5 : 1);
    place(
      {
        type: e.kind === "rest" ? "rest" : "note",
        event: index,
        pitches: e.pitches,
        midi,
        underlines: e.halvings,
        dotted: e.dotted,
      },
      base,
    );
    for (let n = 0; n < e.extensions; n++) {
      place({ type: "dash", event: index, pitches: [], midi: [], underlines: 0, dotted: false }, 1);
    }
  });
  if (groups.length) bars.push({ groups });
  return bars;
}

function packLines(bars: Bar[], capacity: number): Line[] {
  const lines: Line[] = [];
  let current: Bar[] = [];
  let used = 0;
  for (const bar of bars) {
    const cost = barGlyphs(bar) + BAR_OVERHEAD;
    if (current.length && used + cost > capacity) {
      lines.push({ bars: current });
      current = [];
      used = 0;
    }
    current.push(bar);
    used += cost;
  }
  if (current.length) lines.push({ bars: current });
  return lines;
}

/**
 * Pack bars into as few lines as fit the width, balanced so the last line is
 * not left with a lone bar, then lines into pages by height.
 */
export function layoutJianpu(score: Score, size: SheetSize): JianpuLayout {
  const bars = layoutBars(score);
  const capacity = Math.max(1, size.slotsPerLine);
  let lines = packLines(bars, capacity);
  // Narrowest width that still needs no more lines: evens out line lengths.
  const total = bars.reduce((n, b) => n + barGlyphs(b) + BAR_OVERHEAD, 0);
  for (let width = Math.ceil(total / Math.max(1, lines.length)); width < capacity; width++) {
    const balanced = packLines(bars, width);
    if (balanced.length <= lines.length) {
      lines = balanced;
      break;
    }
  }
  const perPage = Math.max(1, size.linesPerPage);
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([]);
  return { pages };
}

/** Which page holds a given event. */
export function pageOfEvent(layout: JianpuLayout, event: number): number {
  for (let p = 0; p < layout.pages.length; p++) {
    for (const line of layout.pages[p]) {
      for (const bar of line.bars) {
        for (const group of bar.groups) if (group.some((g) => g.event === event)) return p;
      }
    }
  }
  return 0;
}

export interface KeyHint {
  /** `KeyboardEvent.code` of the note key. */
  code: string;
  /** Octave shift to hold: −2 … +2. */
  shift: number;
}

/** Prefer no octave key, then one octave, then two. */
const SHIFT_ORDER = [0, -1, 1, -2, 2];

/** The computer key (and octave shift) that plays a MIDI note, or null if none can. */
export function keyHint(midi: number): KeyHint | null {
  for (const shift of SHIFT_ORDER) {
    const offset = midi - BASE_MIDI - 12 * shift;
    for (const [code, semitone] of Object.entries(NOTE_KEYS)) {
      if (semitone === offset) return { code, shift };
    }
  }
  return null;
}
