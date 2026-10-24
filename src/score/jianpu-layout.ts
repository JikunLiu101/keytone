/**
 * Lays a score out as jianpu: glyphs grouped into beams and bars, bars into
 * lines of N beats, lines into pages, and finally pixel positions where
 * every beat has the same width (spec §11.2). Pure data, so any renderer can
 * draw it and it can be unit-tested.
 */
import { BASE_MIDI } from "../core/notes";
import { NOTE_KEYS } from "../core/keymap";
import { barBeats, pitchMidi, type Pitch, type Score } from "./score";

/** A lyric slot: a note (ext 0) or the ext-th dash that holds it (spec §11.3). */
export interface Slot {
  event: number;
  ext: number;
}

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
  /** Beats from the start of its bar to where it starts. */
  start: number;
  /** Beats its box is wide: its own length, at most one beat. A dash is one beat. */
  span: number;
  /** The lyric slot it fills, or null (rests and the dashes that hold a rest). */
  slot: Slot | null;
}

export interface Bar {
  /** Glyphs grouped so the underlines of notes within one beat join up. */
  groups: Glyph[][];
  /** Beats the bar is wide: the pickup's length for a pickup bar, else a full bar. */
  beats: number;
}

export interface Line {
  bars: Bar[];
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

  const place = (glyph: Omit<Glyph, "start">, beats: number) => {
    const beat = Math.floor(pos + EPS);
    const last = groups[groups.length - 1];
    const placed: Glyph = { ...glyph, start: pos };
    if (glyph.underlines > 0 && last && beamBeat === beat && last[last.length - 1].underlines > 0) {
      last.push(placed);
    } else {
      groups.push([placed]);
      beamBeat = glyph.underlines > 0 ? beat : -1;
    }
    pos += beats;
    if (pos >= length - EPS) {
      bars.push({ groups, beats: length });
      groups = [];
      pos = Math.max(0, pos - length);
      length = barLength;
      beamBeat = -1;
    }
  };

  score.events.forEach((e, index) => {
    const midi = e.pitches.map((p) => pitchMidi(p, score.key));
    const base = (1 / 2 ** e.halvings) * (e.dotted ? 1.5 : 1);
    const sounding = e.kind !== "rest" && e.pitches.length > 0;
    place(
      {
        type: e.kind === "rest" ? "rest" : "note",
        event: index,
        pitches: e.pitches,
        midi,
        underlines: e.halvings,
        dotted: e.dotted,
        span: Math.min(1, base),
        slot: sounding ? { event: index, ext: 0 } : null,
      },
      base,
    );
    for (let n = 0; n < e.extensions; n++) {
      place(
        {
          type: "dash",
          event: index,
          pitches: [],
          midi: [],
          underlines: 0,
          dotted: false,
          span: 1,
          slot: sounding ? { event: index, ext: n + 1 } : null,
        },
        1,
      );
    }
  });
  // The unfinished last bar keeps its full width, so it doesn't grow as notes are added.
  if (groups.length) bars.push({ groups, beats: length });
  return bars;
}

/** Fill lines with whole bars, as many as fit in N beats; a line always holds at least one. */
export function layoutLines(score: Score, beatsPerLine: number): Line[] {
  const lines: Line[] = [];
  let current: Bar[] = [];
  let used = 0;
  for (const bar of layoutBars(score)) {
    if (current.length && used + bar.beats > beatsPerLine + EPS) {
      lines.push({ bars: current });
      current = [];
      used = 0;
    }
    current.push(bar);
    used += bar.beats;
  }
  if (current.length) lines.push({ bars: current });
  return lines;
}

/** Split lines into pages; an empty score still has one (empty) page. */
export function layoutPages(lines: Line[], linesPerPage: number): Line[][] {
  const perPage = Math.max(1, linesPerPage);
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([]);
  return pages;
}

/** Which page holds a given event. */
export function pageOfEvent(pages: Line[][], event: number): number {
  for (let p = 0; p < pages.length; p++) {
    for (const line of pages[p]) {
      for (const bar of line.bars) {
        for (const group of bar.groups) if (group.some((g) => g.event === event)) return p;
      }
    }
  }
  return 0;
}

/** A sheet's measured size. */
export interface SheetBox {
  /** Content width in px. */
  width: number;
  /** Lines that fit in the height. */
  linesPerPage: number;
}

/**
 * Keeps the previous box object when nothing really changed, so measuring
 * doesn't re-render. A sheet's padding is in em and its font follows its
 * width, so each measurement nudges the width by a fraction of a px; small
 * changes are ignored or the measuring would never settle.
 */
export function sameSheetBox(prev: SheetBox, next: SheetBox): SheetBox {
  return Math.abs(prev.width - next.width) < 2 && prev.linesPerPage === next.linesPerPage ? prev : next;
}

/** Pixel sizes for one sheet. */
export interface SheetMetrics {
  /** Width of one beat. */
  beat: number;
  /** Gap after each bar, holding its bar line. */
  gap: number;
  /** Digit font size. */
  font: number;
}

/** A bar-line gap, as a share of a beat. */
const GAP_BEATS = 0.4;

/**
 * Sizes for a sheet `width` px wide holding N beats a line. Room is left for
 * one gap per bar plus one (a pickup bar). Digits are small enough that four
 * sixteenth notes fit in a beat, within 11–24 px.
 */
export function sheetMetrics(width: number, beatsPerLine: number, barLength: number): SheetMetrics {
  const bars = Math.floor(beatsPerLine / barLength) + 1;
  const beat = width / (beatsPerLine + GAP_BEATS * bars);
  return { beat, gap: GAP_BEATS * beat, font: Math.min(24, Math.max(11, 0.36 * beat)) };
}

export interface PlacedGlyph {
  glyph: Glyph;
  /** Left edge of the glyph's box, in px from the start of the line. */
  x: number;
  width: number;
}

export interface PlacedLine {
  glyphs: PlacedGlyph[];
  /** Each bar's left edge and width (its bar line sits in the gap after it). */
  bars: { x: number; width: number }[];
  width: number;
}

/** Pixel positions of a line's glyphs and bars. */
export function placeLine(line: Line, m: SheetMetrics): PlacedLine {
  const glyphs: PlacedGlyph[] = [];
  const bars: PlacedLine["bars"] = [];
  let x = 0;
  for (const bar of line.bars) {
    const width = bar.beats * m.beat;
    bars.push({ x, width });
    for (const group of bar.groups) {
      for (const glyph of group) glyphs.push({ glyph, x: x + glyph.start * m.beat, width: glyph.span * m.beat });
    }
    x += width + m.gap;
  }
  return { glyphs, bars, width: x };
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
