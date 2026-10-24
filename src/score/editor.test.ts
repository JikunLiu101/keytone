import { describe, expect, it } from "vitest";
import { edit, editorActionForCode, pasteEvents, selectedEvents, type EditorAction, type EditorState } from "./editor";
import { emptyScore, eventBeats, parseScore, serializeEvents, serializeScore } from "./score";

function run(...actions: EditorAction[]): EditorState {
  let state: EditorState = { score: emptyScore(), cursor: 0 };
  for (const a of actions) state = edit(state, a).state;
  return state;
}

const note = (degree: number, octave = 0): EditorAction => ({ type: "note", degree, octave });
const body = (state: EditorState) => serializeScore(state.score).split("---\n")[1].trim();

describe("edit", () => {
  it("types notes, rests and extensions", () => {
    const s = run(note(1), note(2), { type: "rest" }, note(5), { type: "extend" }, { type: "extend" });
    expect(body(s)).toBe("1 2 0 5 - - |");
    expect(s.cursor).toBe(4);
  });

  it("applies / and . to the note just typed, cycling /", () => {
    const s = run(note(5), { type: "dot" }, { type: "halve" }, note(5), { type: "halve" }, { type: "halve" });
    expect(s.score.events.map(eventBeats)).toEqual([0.75, 0.25]);
    const cycled = run(note(1), { type: "halve" }, { type: "halve" }, { type: "halve" });
    expect(eventBeats(cycled.score.events[0])).toBe(1);
  });

  it("enters octaves and refuses notes off the keyboard", () => {
    expect(body(run(note(1, 1), note(7, -1)))).toBe("1' 7,");
    const result = edit({ score: emptyScore(), cursor: 0 }, note(1, -3));
    expect(result.rejected).toBe("range");
    expect(result.state.score.events).toHaveLength(0);
  });

  it("auditions typed notes", () => {
    expect(edit({ score: emptyScore(), cursor: 0 }, note(5)).audition).toEqual([55]);
  });

  it("raises and lowers with the arrows, within one semitone", () => {
    const s = run(note(4), { type: "accidental", direction: 1 }, { type: "accidental", direction: 1 });
    expect(body(s)).toBe("#4");
    expect(body(run(note(7), { type: "accidental", direction: -1 }))).toBe("b7");
  });

  it("inserts at the cursor and moves with the arrows", () => {
    const s = run(note(1), note(3), { type: "left" }, note(2), { type: "end" }, note(4));
    expect(body(s)).toBe("1 2 3 4 |");
    expect(run(note(1), { type: "home" }, note(7, -1)).score.events[0].pitches[0].octave).toBe(-1);
  });

  it("backspace shortens a held note before removing it", () => {
    let s = run(note(1), note(5), { type: "extend" });
    s = edit(s, { type: "backspace" }).state;
    expect(body(s)).toBe("1 5");
    s = edit(s, { type: "backspace" }).state;
    expect(body(s)).toBe("1");
    expect(s.cursor).toBe(1);
  });

  it("delete removes the event after the cursor", () => {
    const s = run(note(1), note(2), { type: "home" }, { type: "delete" });
    expect(body(s)).toBe("2");
    expect(s.cursor).toBe(0);
  });

  it("does nothing harmful at the edges", () => {
    const empty = run({ type: "extend" }, { type: "halve" }, { type: "backspace" }, { type: "delete" }, { type: "left" });
    expect(empty.score.events).toHaveLength(0);
    expect(empty.cursor).toBe(0);
  });

  it("keeps the cursor valid when the score is replaced", () => {
    const s = edit(run(note(1), note(2), note(3)), { type: "replace", score: parseScore("1").score }).state;
    expect(s.cursor).toBe(1);
  });
});

describe("selection", () => {
  const four = () => run(note(1), note(2), note(3), note(4));

  it("extends a selection from the cursor and copies the selected notes as text", () => {
    const s = edit(edit(edit(four(), { type: "home" }).state, { type: "select", cursor: 1 }).state, { type: "select", cursor: 3 }).state;
    expect([s.anchor, s.cursor]).toEqual([0, 3]);
    expect(serializeEvents(selectedEvents(s))).toBe("1 2 3");
  });

  it("replaces the selection when a note is typed", () => {
    const s = edit(edit(four(), { type: "select", cursor: 1 }).state, note(7)).state;
    expect(body(s)).toBe("1 7");
    expect(s.cursor).toBe(2);
    expect(s.anchor ?? null).toBeNull();
  });

  it("deletes the selection with Backspace or Delete", () => {
    const sel = edit(edit(four(), { type: "moveTo", cursor: 1 }).state, { type: "select", cursor: 3 }).state;
    expect(body(edit(sel, { type: "backspace" }).state)).toBe("1 4");
    expect(body(edit(sel, { type: "delete" }).state)).toBe("1 4");
    expect(edit(sel, { type: "delete" }).state.cursor).toBe(1);
  });

  it("collapses the selection with a plain arrow", () => {
    const sel = edit(edit(four(), { type: "moveTo", cursor: 1 }).state, { type: "select", cursor: 3 }).state;
    expect(edit(sel, { type: "left" }).state).toMatchObject({ cursor: 1 });
    expect(edit(sel, { type: "right" }).state).toMatchObject({ cursor: 3 });
    expect(edit(sel, { type: "left" }).state.anchor ?? null).toBeNull();
  });

  it("selects nothing when the selection is empty", () => {
    expect(selectedEvents(four())).toEqual([]);
  });
});

describe("insert (paste)", () => {
  it("inserts pasted notes at the cursor, replacing a selection", () => {
    const s = run(note(1), note(4));
    const { events } = pasteEvents("2 3 -");
    const pasted = edit(edit(s, { type: "moveTo", cursor: 1 }).state, { type: "insert", events }).state;
    expect(body(pasted)).toBe("1 2 3 - | 4");
    expect(pasted.cursor).toBe(3);
    const first = edit(edit(pasted, { type: "moveTo", cursor: 0 }).state, { type: "select", cursor: 1 }).state;
    const replaced = edit(first, { type: "insert", events: pasteEvents("7").events }).state;
    expect(body(replaced)).toBe("7 2 3 - | 4");
  });

  it("round-trips copied notes", () => {
    const s = run(note(5), { type: "dot" }, { type: "halve" }, note(5), { type: "halve" }, { type: "halve" }, note(6, 1), { type: "extend" });
    expect(pasteEvents(serializeEvents(s.score.events)).events).toEqual(s.score.events);
  });

  it("refuses pasted notes off the keyboard and leaves the score as it was", () => {
    const s = run(note(1));
    const result = edit(s, { type: "insert", events: pasteEvents("1''''").events });
    expect(result.rejected).toBe("range");
    expect(result.state).toBe(s);
  });

  it("uses only the notes of a pasted whole score, and reports junk", () => {
    expect(pasteEvents("title: x\nkey: G\n---\n1 2\n---\nla la").events).toHaveLength(2);
    const junk = pasteEvents("1 x 2");
    expect(junk.events).toHaveLength(2);
    expect(junk.errors).toHaveLength(1);
    expect(pasteEvents("hello").events).toEqual([]);
  });
});

describe("editorActionForCode", () => {
  it("maps digits, numpad and symbols", () => {
    expect(editorActionForCode("Digit3", 1)).toEqual({ type: "note", degree: 3, octave: 1 });
    expect(editorActionForCode("Numpad0", 0)).toEqual({ type: "rest" });
    expect(editorActionForCode("Digit8", 0)).toBeNull();
    expect(editorActionForCode("Minus", 0)).toEqual({ type: "extend" });
    expect(editorActionForCode("Slash", 0)).toEqual({ type: "halve" });
    expect(editorActionForCode("Period", 0)).toEqual({ type: "dot" });
    expect(editorActionForCode("KeyZ", 0)).toBeNull();
  });
});
