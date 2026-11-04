import { describe, expect, it } from "vitest";
import { emptyScore } from "../score/score";
import { appliedOctave, octaveChange, ownOctave } from "./base-octave";
import type { ScoreView } from "./settings";

const settings = (scoreView: ScoreView, baseOctave = 4, builtinOctaves: Record<string, number> = {}) => ({ scoreView, baseOctave, builtinOctaves });
const userScore = (octave: number | null) => ({ id: "user:a", builtin: false, score: { ...emptyScore("A"), octave } });
const builtin = { id: "builtin:twinkle", builtin: true, score: emptyScore("Twinkle") };

describe("ownOctave", () => {
  it("is a user score's octave, or the one remembered for a built-in", () => {
    expect(ownOctave(settings("off"), userScore(5))).toBe(5);
    expect(ownOctave(settings("off"), userScore(null))).toBeNull();
    expect(ownOctave(settings("off", 4, { "builtin:twinkle": 3 }), builtin)).toBe(3);
    expect(ownOctave(settings("off"), builtin)).toBeNull();
  });
});

describe("appliedOctave", () => {
  it("is the global base with the score view off, even for a score with its own", () => {
    expect(appliedOctave(settings("off", 4), userScore(5), false)).toBe(4);
  });

  it("is the shown score's own base, or the global one when it has none", () => {
    expect(appliedOctave(settings("jianpu", 4), userScore(5), false)).toBe(5);
    expect(appliedOctave(settings("falling", 4), userScore(5), false)).toBe(5);
    expect(appliedOctave(settings("jianpu", 4), userScore(null), false)).toBe(4);
    expect(appliedOctave(settings("jianpu", 4, { "builtin:twinkle": 3 }), builtin, false)).toBe(3);
  });

  it("is the edited score's while the editor is open, whatever the view", () => {
    expect(appliedOctave(settings("off", 4), userScore(5), true)).toBe(5);
    expect(appliedOctave(settings("off", 3), userScore(null), true)).toBe(3);
  });
});

describe("octaveChange", () => {
  it("changes the global base with the score view off", () => {
    expect(octaveChange(settings("off", 4), userScore(5), false, 1)).toEqual({ target: "global", octave: 5 });
  });

  it("changes the shown score's base, starting from the global one when it has none", () => {
    expect(octaveChange(settings("jianpu", 4), userScore(null), false, -1)).toEqual({ target: "score", octave: 3 });
    expect(octaveChange(settings("jianpu", 4, { "builtin:twinkle": 3 }), builtin, false, 1)).toEqual({ target: "builtin", octave: 4 });
  });

  it("does nothing while the editor is open, where the Register field changes it", () => {
    expect(octaveChange(settings("off", 4), userScore(5), true, -1)).toBeNull();
    expect(octaveChange(settings("jianpu", 4), userScore(null), true, 1)).toBeNull();
  });

  it("does nothing past C2 or C5", () => {
    expect(octaveChange(settings("off", 5), userScore(null), false, 1)).toBeNull();
    expect(octaveChange(settings("jianpu", 4), userScore(2), false, -1)).toBeNull();
  });
});
