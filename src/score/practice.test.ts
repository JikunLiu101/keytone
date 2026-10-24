import { describe, expect, it } from "vitest";
import {
  PRACTICE_START,
  isComplete,
  phraseBackTarget,
  phraseStarts,
  practicePress,
  practiceSteps,
  practiceTarget,
  type PracticeState,
} from "./practice";
import { parseScore } from "./score";

const steps = (notes: string) => practiceSteps(parseScore(`---\n${notes}`).score);

function play(notes: string, keys: number[]): PracticeState {
  const s = steps(notes);
  return keys.reduce((state, midi) => practicePress(s, state, midi), PRACTICE_START);
}

describe("practice", () => {
  it("skips rests and held beats", () => {
    expect(steps("1 0 3 - 5").map((s) => [s.event, s.midi])).toEqual([
      [0, [48]],
      [2, [52]],
      [3, [55]],
    ]);
  });

  it("advances only on the right note and counts misses", () => {
    const state = play("1 2", [50, 48, 49]);
    expect(state).toEqual({ step: 1, pressed: [], misses: 2 });
  });

  it("needs a separate press for each repeated note", () => {
    expect(play("1 1 1", [48, 48]).step).toBe(2);
  });

  it("needs every note of a chord, in any order", () => {
    const s = steps("[1 3 5] 2");
    let state = practicePress(s, PRACTICE_START, 55);
    state = practicePress(s, state, 48);
    expect(state).toMatchObject({ step: 0, pressed: [55, 48] });
    state = practicePress(s, state, 52);
    expect(state.step).toBe(1);
  });

  it("completes after the last note and then ignores keys", () => {
    const s = steps("1 2");
    const done = play("1 2", [48, 50]);
    expect(isComplete(s, done)).toBe(true);
    expect(practicePress(s, done, 48)).toBe(done);
  });

  it("is complete straight away for a score with no notes", () => {
    expect(isComplete(steps("0 0"), PRACTICE_START)).toBe(true);
  });
});

describe("phrases", () => {
  const score = parseScore("---\n1 2 3 - 4 5 0 6 7 1' - 2'").score;
  const s = practiceSteps(score);
  const starts = phraseStarts(score, s);

  it("start after rests and held notes", () => {
    // steps: 1 2 3- | 4 5 0 | 6 7 1'- | 2'
    expect(starts).toEqual([0, 3, 5, 8]);
  });

  it("Backspace goes to the phrase start, then the one before", () => {
    expect(phraseBackTarget(starts, 7)).toBe(5);
    expect(phraseBackTarget(starts, 5)).toBe(3);
    expect(phraseBackTarget(starts, 0)).toBe(0);
    expect(phraseBackTarget(starts, s.length)).toBe(8);
  });
});

describe("practiceTarget", () => {
  const starts = [0, 4, 8];

  it("moves by phrase, by step, or back to the start", () => {
    expect(practiceTarget("phraseBack", 6, starts, false)).toBe(4);
    expect(practiceTarget("stepBack", 6, starts, false)).toBe(5);
    expect(practiceTarget("stepForward", 6, starts, false)).toBe(7);
    expect(practiceTarget("restart", 6, starts, false)).toBe(0);
  });

  it("starts again with Enter (play) once the score is complete, and ignores it before", () => {
    expect(practiceTarget("playPause", 12, starts, true)).toBe(0);
    expect(practiceTarget("playPause", 6, starts, false)).toBeNull();
    expect(practiceTarget("speedUp", 6, starts, false)).toBeNull();
  });
});
