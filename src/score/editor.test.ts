import { describe, expect, it } from "vitest";
import { edit, editorActionForCode, type EditorAction, type EditorState } from "./editor";
import { emptyScore, eventBeats, parseScore, serializeScore } from "./score";

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
