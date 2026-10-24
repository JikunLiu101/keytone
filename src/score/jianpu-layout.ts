/**
 * Lays a score out as jianpu: glyphs grouped into beams and bars, bars into
 * lines of N beats, lines into pages, and finally pixel positions where
 * every beat has the same width (spec §11.2). Pure data, so any renderer can
 * draw it and it can be unit-tested.
 */
import { BASE_MIDI } from "../core/notes";
import { NOTE_KEYS } from "../core/keymap";
import type { LyricItem } from "./lyrics";
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

export interface PlacedLyrics {
  /**
   * Words centred at `x` (px from the line start), drawn at `scale` of the
   * lyrics font; punctuation after a word (`tail`) hangs to its right.
   */
  words: { x: number; text: string; tail: string; scale: number; slot: Slot; misplaced: boolean }[];
  /** Brackets tying the parts of a split word into one word. */
  brackets: { x1: number; x2: number }[];
  /** Lines showing a word is held over the following beats. */
  holds: { x1: number; x2: number }[];
}

/** Rough width of `text` in em: wide CJK characters, narrower Latin letters, thin punctuation. */
export function textWidthEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u.test(ch)) em += 1;
    else if (/[A-Z]/.test(ch)) em += 0.62;
    else if (/[\p{L}\p{N}]/u.test(ch)) em += 0.52;
    else em += 0.3;
  }
  return em;
}

/** Smallest a word is drawn before it is allowed to overlap its neighbours. */
const MIN_LYRIC_SCALE = 0.6;

/**
 * Lyrics of one placed line (spec §11.3): each word under its note, shrunk
 * when wider than the room between its neighbours; a bracket under the parts
 * of a split word; a hold line from a word to the end of its last held beat.
 * `font` is the lyrics font size in px.
 */
export function placeLyrics(line: PlacedLine, itemAt: (slot: Slot) => LyricItem | null, font: number): PlacedLyrics {
  const pad = 0.15 * font;
  const entries = line.glyphs.flatMap((g) => {
    const slot = g.glyph.slot;
    const item = slot ? itemAt(slot) : null;
    return slot && item ? [{ slot, item, left: g.x, x: g.x + g.width / 2, right: g.x + g.width }] : [];
  });

  const words: PlacedLyrics["words"] = [];
  // Entry index → how far the drawn word reaches left and right of its centre.
  const reach = new Map<number, { left: number; right: number }>();
  const wordEntries = entries.flatMap((e, i) => (e.item.kind === "word" ? [i] : []));
  wordEntries.forEach((i, k) => {
    const e = entries[i];
    if (e.item.kind !== "word") return;
    const left = k > 0 ? e.x - entries[wordEntries[k - 1]].x : Infinity;
    const right = k < wordEntries.length - 1 ? entries[wordEntries[k + 1]].x - e.x : Infinity;
    const room = 2 * Math.min(left, right) - pad;
    const [, text, tail] = /^(.*?)([^\p{L}\p{N}'’]*)$/su.exec(e.item.text)!;
    const core = textWidthEm(text) * font;
    const width = core + textWidthEm(tail) * font;
    const scale = width > room ? Math.max(MIN_LYRIC_SCALE, room / width) : 1;
    reach.set(i, { left: (core / 2) * scale, right: (width - core / 2) * scale });
    words.push({ x: e.x, text, tail, scale, slot: e.slot, misplaced: e.slot.ext > 0 });
  });

  const brackets: PlacedLyrics["brackets"] = [];
  const holds: PlacedLyrics["holds"] = [];
  for (let i = 0; i < entries.length; i++) {
    const item = entries[i].item;
    if (item.kind === "word" && (item.joinNext || item.joinPrev)) {
      // A split word: its parts are consecutive items; a part continued from the
      // line before starts the bracket at the line's start.
      let j = i;
      while (j + 1 < entries.length) {
        const cur = entries[j].item;
        const nxt = entries[j + 1].item;
        if (cur.kind !== "word" || !cur.joinNext || nxt.kind !== "word" || !nxt.joinPrev) break;
        j++;
      }
      const last = entries[j].item;
      const x1 = item.joinPrev ? 0 : entries[i].x - (reach.get(i)?.left ?? 0);
      const open = last.kind === "word" && last.joinNext;
      const x2 = entries[j].x + (reach.get(j)?.right ?? 0) + (open ? 2 * pad : 0);
      if (j > i || item.joinPrev || open) brackets.push({ x1, x2 });
      i = j;
    } else if (item.kind === "hold") {
      let j = i;
      while (j + 1 < entries.length && entries[j + 1].item.kind === "hold") j++;
      const before = i > 0 ? entries[i - 1] : null;
      // From the end of the held word, or from the first held beat when the word is on the line before.
      const x1 = before && before.item.kind === "word" ? before.x + (reach.get(i - 1)?.right ?? 0) + pad : entries[i].left;
      holds.push({ x1, x2: entries[j].right - pad });
      i = j;
    }
  }
  return { words, brackets, holds };
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
