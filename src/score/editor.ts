/**
 * The score editor's model: a score plus a cursor, and the edits each key
 * makes. Pure functions, so every key's behaviour is unit-tested.
 *
 * The cursor is an insertion point between events (0 … events.length).
 * Duration and pitch tweaks (`-`, `/`, `.`, ↑, ↓) apply to the event just
 * before the cursor, i.e. the note you just typed.
 */
import { inRange, pitchMidi, type Pitch, type Score, type ScoreEvent } from "./score";

export interface EditorState {
  score: Score;
  cursor: number;
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
  | { type: "replace"; score: Score };

export interface EditResult {
  state: EditorState;
  /** Set when the edit was refused because a note would leave the keyboard. */
  rejected?: "range";
  /** MIDI notes to audition (a new or changed note). */
  audition?: number[];
}

function withEvents(state: EditorState, events: ScoreEvent[], cursor: number): EditorState {
  return { score: { ...state.score, events }, cursor: Math.max(0, Math.min(events.length, cursor)) };
}

/** Apply `change` to the event before the cursor, if there is one. */
function changePrevious(state: EditorState, change: (e: ScoreEvent) => ScoreEvent | null): EditResult {
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
      return { state: insert(state, event), audition: [midi] };
    }
    case "rest":
      return { state: insert(state, { kind: "rest", pitches: [], halvings: 0, dotted: false, extensions: 0 }) };
    case "extend":
      return changePrevious(state, (e) => ({ ...e, extensions: e.extensions + 1 }));
    case "halve":
      // One beat → half → quarter → back to one beat.
      return changePrevious(state, (e) => ({ ...e, halvings: (e.halvings + 1) % 3 }));
    case "dot":
      return changePrevious(state, (e) => ({ ...e, dotted: !e.dotted }));
    case "accidental": {
      const target = events[state.cursor - 1];
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
      const target = events[state.cursor - 1];
      if (!target) return { state };
      // A held note shortens first; then the note itself goes.
      if (target.extensions > 0) return changePrevious(state, (e) => ({ ...e, extensions: e.extensions - 1 }));
      const next = events.slice();
      next.splice(state.cursor - 1, 1);
      return { state: withEvents(state, next, state.cursor - 1) };
    }
    case "delete": {
      if (state.cursor >= events.length) return { state };
      const next = events.slice();
      next.splice(state.cursor, 1);
      return { state: withEvents(state, next, state.cursor) };
    }
    case "left":
      return { state: withEvents(state, events, state.cursor - 1) };
    case "right":
      return { state: withEvents(state, events, state.cursor + 1) };
    case "home":
      return { state: withEvents(state, events, 0) };
    case "end":
      return { state: withEvents(state, events, events.length) };
    case "moveTo":
      return { state: withEvents(state, events, action.cursor) };
    case "replace":
      return { state: { score: action.score, cursor: Math.min(state.cursor, action.score.events.length) } };
  }
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
