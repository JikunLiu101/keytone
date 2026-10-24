/**
 * Lyrics (spec §11.3): one line of text whose items fill the score's lyric
 * slots in order. A slot is a note, or a dash that holds a note; rests are
 * not slots. Pure functions, no DOM.
 */
import type { Slot } from "./jianpu-layout";
import type { Score } from "./score";

export type LyricItem =
  | {
      kind: "word";
      /** What is drawn: a Chinese character, an English word or part of one, plus any punctuation after it. */
      text: string;
      /** The word goes on over the next note (`hap-py`: "hap" joins next). */
      joinNext: boolean;
      /** This part carries on a word from the previous note. */
      joinPrev: boolean;
      /** Where the item is in the lyrics text: [from, to). */
      from: number;
      to: number;
    }
  | {
      /** "hold": keep singing the previous word; "skip": this note is not sung. */
      kind: "hold" | "skip";
      from: number;
      to: number;
    };

/** Characters that are each a sung syllable of their own. */
const SYLLABLE_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** Characters that make up an English (or other spaced-script) word. */
const WORD_CHAR = /[\p{L}\p{N}'’]/u;
const LETTER = /\p{L}/u;

/** Full-width forms a Chinese input method types, read like their ASCII twins. */
function normalize(ch: string): string {
  if (ch === "－") return "-";
  if (ch === "０") return "0";
  return ch;
}

const isWordChar = (ch: string | undefined) => !!ch && WORD_CHAR.test(ch) && !SYLLABLE_CHAR.test(ch);

export function parseLyrics(text: string): LyricItem[] {
  const items: LyricItem[] = [];
  let word: Extract<LyricItem, { kind: "word" }> | null = null;
  const flush = () => {
    if (word) items.push(word);
    word = null;
  };
  const chars = Array.from(text);
  let offset = 0;
  for (let i = 0; i < chars.length; i++) {
    const raw = chars[i];
    const from = offset;
    offset += raw.length;
    const ch = normalize(raw);
    const next = chars[i + 1] === undefined ? undefined : normalize(chars[i + 1]);

    if (/\s/u.test(ch)) {
      flush();
    } else if (SYLLABLE_CHAR.test(ch)) {
      flush();
      items.push({ kind: "word", text: ch, joinNext: false, joinPrev: false, from, to: offset });
    } else if (ch === "-") {
      if (word && isWordChar(next)) {
        // Between two letters: the word goes on over the next note.
        const part: Extract<LyricItem, { kind: "word" }> = word;
        part.joinNext = true;
        flush();
        word = { kind: "word", text: "", joinNext: false, joinPrev: true, from: offset, to: offset };
      } else {
        flush();
        items.push({ kind: "hold", from, to: offset });
      }
    } else if (ch === "0" && !word && !(next && LETTER.test(next) && !SYLLABLE_CHAR.test(next))) {
      flush();
      items.push({ kind: "skip", from, to: offset });
    } else if (isWordChar(ch)) {
      if (!word) word = { kind: "word", text: "", joinNext: false, joinPrev: false, from, to: from };
      word.text += raw;
      word.to = offset;
    } else {
      // Punctuation stays with the previous word and takes no slot.
      flush();
      for (let k = items.length - 1; k >= 0; k--) {
        const item = items[k];
        if (item.kind === "word") {
          item.text += raw;
          item.to = offset;
          break;
        }
      }
    }
  }
  flush();
  return items;
}

/** The score's lyric slots in order: each note or chord, then each dash that holds it. */
export function lyricSlots(score: Score): Slot[] {
  const slots: Slot[] = [];
  score.events.forEach((e, event) => {
    if (e.kind === "rest" || !e.pitches.length) return;
    for (let ext = 0; ext <= e.extensions; ext++) slots.push({ event, ext });
  });
  return slots;
}

export interface AlignedLyrics {
  /** The item on each slot, or null when the lyrics ran out. */
  bySlot: (LyricItem | null)[];
  /** Items left over after the last slot. */
  extra: LyricItem[];
  /** Slot indices where a word falls on a dash: most likely the lyrics are out of line. */
  misplaced: number[];
}

export function alignLyrics(slots: Slot[], items: LyricItem[]): AlignedLyrics {
  const bySlot = slots.map((_, i) => items[i] ?? null);
  const misplaced = slots.flatMap((slot, i) => (slot.ext > 0 && bySlot[i]?.kind === "word" ? [i] : []));
  return { bySlot, extra: items.slice(slots.length), misplaced };
}

/** Key of a slot, for looking items up by slot. */
export function slotKey(slot: Slot): string {
  return `${slot.event}:${slot.ext}`;
}

export interface ScoreLyrics extends AlignedLyrics {
  items: LyricItem[];
  slots: Slot[];
  /** The item on a slot, or null. */
  itemAt: (slot: Slot) => LyricItem | null;
}

/** A score's lyrics lined up with its slots, or null when it has none. */
export function buildLyrics(score: Score): ScoreLyrics | null {
  const items = parseLyrics(score.lyrics);
  if (!items.length) return null;
  const slots = lyricSlots(score);
  const aligned = alignLyrics(slots, items);
  const bySlot = new Map(slots.map((slot, i) => [slotKey(slot), aligned.bySlot[i]]));
  return { ...aligned, items, slots, itemAt: (slot) => bySlot.get(slotKey(slot)) ?? null };
}
