/**
 * The score editor's model: a score plus a cursor, and the edits each key
 * makes. Pure functions, so every key's behaviour is unit-tested.
 *
 * The cursor is an insertion point between events (0 … events.length).
 * Duration and pitch tweaks (`-`, `/`, `.`, ↑, ↓) apply to the event just
 * before the cursor, i.e. the note you just typed.
 */
import { inRange, parseScore, pitchMidi, type ParseError, type Pitch, type Score, type ScoreEvent } from "./score";

export interface EditorState {
  score: Score;
  cursor: number;
  /**
   * Where a selection started; the selection is the events between `anchor`
   * and `cursor`. Absent or null: no selection. A note and its `-`s are one
   * event, so a selection always covers whole notes (spec §11.4).
   */
  anchor?: number | null;
}

export type EditorAction =
  | { type: "note"; degree: number; octave: number }
  | { type: "rest" }
  | { type: "extend" }
  | { type: "halve" }
  | { type: "dot" }
  | { type: "accidental"; direction: 1 | -1 }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "left" }
  | { type: "right" }
  | { type: "home" }
  | { type: "end" }
  | { type: "moveTo"; cursor: number }
  /** Move the cursor and keep (or start) a selection from where it was. */
  | { type: "select"; cursor: number }
  /** Insert events at the cursor, replacing the selection (paste). */
  | { type: "insert"; events: ScoreEvent[] };

export interface EditResult {
  state: EditorState;
  /** Set when the edit was refused because a note would leave the keyboard. */
  rejected?: "range";
  /** MIDI notes to audition (a new or changed note). */
  audition?: number[];
}

function withEvents(state: EditorState, events: ScoreEvent[], cursor: number): EditorState {
  return { score: { ...state.score, events }, cursor: Math.max(0, Math.min(events.length, cursor)), anchor: null };
}

/** The selected range [start, end), or null when nothing is selected. */
export function selectionRange(state: EditorState): [number, number] | null {
  const { anchor, cursor } = state;
  if (anchor === undefined || anchor === null || anchor === cursor) return null;
  return [Math.min(anchor, cursor), Math.max(anchor, cursor)];
}

/** The selected events (empty when nothing is selected). */
export function selectedEvents(state: EditorState): ScoreEvent[] {
  const range = selectionRange(state);
  return range ? state.score.events.slice(range[0], range[1]) : [];
}

/** Remove the selection, leaving the cursor where it was. */
function deleteSelection(state: EditorState): EditorState {
  const range = selectionRange(state);
  if (!range) return state.anchor === undefined || state.anchor === null ? state : { ...state, anchor: null };
  const events = state.score.events.slice();
  events.splice(range[0], range[1] - range[0]);
  return withEvents(state, events, range[0]);
}

/**
 * What to tell the player after a paste: nothing when it all went in;
 * otherwise why not. `result` is null when the score is read-only.
 */
export function pasteNotice(result: EditResult | null, errors: ParseError[]): "readOnly" | "range" | "skipped" | null {
  if (!result) return "readOnly";
  if (result.rejected) return "range";
  return errors.length ? "skipped" : null;
}

/**
 * Read pasted melody text. A whole score (with a header and `---`) gives its
 * notes only. Range is not checked here: degrees are read in the target
 * score's key when inserted.
 */
export function pasteEvents(text: string): { events: ScoreEvent[]; errors: ParseError[] } {
  const whole = text.split(/\r?\n/).some((l) => l.trim() === "---");
  const { score, errors } = parseScore(whole ? text : `---\n${text}`);
  return { events: score.events, errors: errors.filter((e) => e.code !== "outOfRange") };
}

/**
 * Apply `change` to the event before the cursor, if there is one. With a
 * selection, that is its last note, whichever way it was selected.
 */
function changePrevious(state: EditorState, change: (e: ScoreEvent) => ScoreEvent | null): EditResult {
  const range = selectionRange(state);
  if (range) state = { ...state, cursor: range[1], anchor: null };
  const index = state.cursor - 1;
  const target = state.score.events[index];
  if (!target) return { state };
  const next = change(target);
  if (!next) return { state };
  const events = state.score.events.slice();
  events[index] = next;
  return { state: withEvents(state, events, state.cursor) };
}

function midiOf(state: EditorState, pitches: Pitch[]): number[] {
  return pitches.map((p) => pitchMidi(p, state.score.key));
}

function insert(state: EditorState, event: ScoreEvent): EditorState {
  const events = state.score.events.slice();
  events.splice(state.cursor, 0, event);
  return withEvents(state, events, state.cursor + 1);
}

export function edit(state: EditorState, action: EditorAction): EditResult {
  const { events } = state.score;
  switch (action.type) {
    case "note": {
      const pitch: Pitch = { degree: action.degree, octave: action.octave, accidental: 0 };
      const midi = pitchMidi(pitch, state.score.key);
      if (!inRange(midi)) return { state, rejected: "range" };
      const event: ScoreEvent = { kind: "note", pitches: [pitch], halvings: 0, dotted: false, extensions: 0 };
      return { state: insert(deleteSelection(state), event), audition: [midi] };
    }
    case "rest":
      return { state: insert(deleteSelection(state), { kind: "rest", pitches: [], halvings: 0, dotted: false, extensions: 0 }) };
    case "insert": {
      const key = state.score.key;
      if (action.events.some((e) => e.pitches.some((p) => !inRange(pitchMidi(p, key))))) return { state, rejected: "range" };
      const base = deleteSelection(state);
      const next = base.score.events.slice();
      next.splice(base.cursor, 0, ...action.events);
      return { state: withEvents(base, next, base.cursor + action.events.length) };
    }
    case "select":
      return {
        state: {
          ...state,
          cursor: Math.max(0, Math.min(events.length, action.cursor)),
          anchor: state.anchor ?? state.cursor,
        },
      };
    case "extend":
      return changePrevious(state, (e) => ({ ...e, extensions: e.extensions + 1 }));
    case "halve":
      // One beat → half → quarter → back to one beat.
      return changePrevious(state, (e) => ({ ...e, halvings: (e.halvings + 1) % 3 }));
    case "dot":
      return changePrevious(state, (e) => ({ ...e, dotted: !e.dotted }));
    case "accidental": {
      const range = selectionRange(state);
      const target = events[(range ? range[1] : state.cursor) - 1];
      if (!target || target.kind === "rest") return { state };
      const pitches = target.pitches.map((p) => ({
        ...p,
        accidental: Math.max(-1, Math.min(1, p.accidental + action.direction)),
      }));
      const midi = midiOf(state, pitches);
      if (!midi.every(inRange)) return { state, rejected: "range" };
      const result = changePrevious(state, (e) => ({ ...e, pitches }));
      return { ...result, audition: midi };
    }
    case "backspace": {
      if (selectionRange(state)) return { state: deleteSelection(state) };
      const target = events[state.cursor - 1];
      if (!target) return { state };
      // A held note shortens first; then the note itself goes.
      if (target.extensions > 0) return changePrevious(state, (e) => ({ ...e, extensions: e.extensions - 1 }));
      const next = events.slice();
      next.splice(state.cursor - 1, 1);
      return { state: withEvents(state, next, state.cursor - 1) };
    }
    case "delete": {
      if (selectionRange(state)) return { state: deleteSelection(state) };
      if (state.cursor >= events.length) return { state };
      const next = events.slice();
      next.splice(state.cursor, 1);
      return { state: withEvents(state, next, state.cursor) };
    }
    case "left": {
      // A plain arrow collapses a selection to its start (or end), like a text box.
      const range = selectionRange(state);
      return { state: withEvents(state, events, range ? range[0] : state.cursor - 1) };
    }
    case "right": {
      const range = selectionRange(state);
      return { state: withEvents(state, events, range ? range[1] : state.cursor + 1) };
    }
    case "home":
      return { state: withEvents(state, events, 0) };
    case "end":
      return { state: withEvents(state, events, events.length) };
    case "moveTo":
      return { state: withEvents(state, events, action.cursor) };
  }
}

/** Where a note's token or glyph (or one of its `-`s) is drawn, in px. */
export interface CursorBox {
  event: number;
  dash: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The cursor for a click at (x, y) on a line of notes (spec §11.4): at the
 * nearest note or `-` (in the same row first), before it on its left half,
 * after it on its right half. A `-` belongs to its note, so the cursor goes
 * after the note. So a click beside a line goes to that end of it. Null when
 * the line has no notes.
 */
export function cursorFromBoxes(boxes: CursorBox[], x: number, y: number): number | null {
  const distance = (v: number, lo: number, hi: number) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  let best: CursorBox | null = null;
  let bestDy = Infinity;
  let bestDx = Infinity;
  for (const box of boxes) {
    const dy = distance(y, box.top, box.bottom);
    const dx = distance(x, box.left, box.right);
    if (dy < bestDy || (dy === bestDy && dx < bestDx)) {
      best = box;
      bestDy = dy;
      bestDx = dx;
    }
  }
  if (!best) return null;
  if (best.dash) return best.event + 1;
  return x < (best.left + best.right) / 2 ? best.event : best.event + 1;
}

/** Digit and symbol keys the editor understands, by `KeyboardEvent.code`. */
export function editorActionForCode(code: string, octave: number): EditorAction | null {
  const digit = /^(?:Digit|Numpad)([0-7])$/.exec(code);
  if (digit) {
    const n = Number(digit[1]);
    return n === 0 ? { type: "rest" } : { type: "note", degree: n, octave };
  }
  switch (code) {
    case "Minus":
    case "NumpadSubtract":
      return { type: "extend" };
    case "Slash":
    case "NumpadDivide":
      return { type: "halve" };
    case "Period":
    case "NumpadDecimal":
      return { type: "dot" };
    case "ArrowUp":
      return { type: "accidental", direction: 1 };
    case "ArrowDown":
      return { type: "accidental", direction: -1 };
    case "Backspace":
      return { type: "backspace" };
    case "Delete":
      return { type: "delete" };
    case "ArrowLeft":
      return { type: "left" };
    case "ArrowRight":
      return { type: "right" };
    case "Home":
      return { type: "home" };
    case "End":
      return { type: "end" };
    default:
      return null;
  }
}
