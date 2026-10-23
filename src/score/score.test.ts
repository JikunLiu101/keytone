import { describe, expect, it } from "vitest";
import { BUILTIN_SCORES } from "./builtin-scores";
import { keyHint, layoutBars, layoutJianpu, pageOfEvent } from "./jianpu-layout";
import { barBeats, eventBeats, parseScore, pitchMidi, scoreBeats, serializeScore } from "./score";

const body = (notes: string, header = "") => parseScore(`${header}---\n${notes}`);

describe("parseScore", () => {
  it("reads the header", () => {
    const { score, errors } = parseScore("title: Song\nkey: G\ntime: 3/4\ntempo: 90\npickup: 1\n---\n1");
    expect(errors).toEqual([]);
    expect(score).toMatchObject({ title: "Song", key: "G", time: "3/4", tempo: 90, pickup: 1 });
  });

  it("accepts enharmonic key names and reports bad values", () => {
    expect(parseScore("key: C#\n---\n1").score.key).toBe("Db");
    const { errors } = parseScore("key: H\ntime: 5/4\ntempo: fast\n---\n1");
    expect(errors).toHaveLength(3);
  });

  it("reads notes, rests, extensions and durations", () => {
    const { score, errors } = body("1 0 5 - - 3/ 4// 6. 2./");
    expect(errors).toEqual([]);
    expect(score.events.map((e) => [e.kind, eventBeats(e)])).toEqual([
      ["note", 1],
      ["rest", 1],
      ["note", 3],
      ["note", 0.5],
      ["note", 0.25],
      ["note", 1.5],
      ["note", 0.75],
    ]);
  });

  it("reads octave marks and accidentals", () => {
    const { score } = body("1' 1'' 7, #4 b7");
    expect(score.events.map((e) => pitchMidi(e.pitches[0], score.key))).toEqual([60, 72, 47, 54, 58]);
  });

  it("puts 1 on the Z key (C3) and transposes with the key", () => {
    expect(pitchMidi({ degree: 1, octave: 0, accidental: 0 }, "C")).toBe(48);
    expect(pitchMidi({ degree: 1, octave: 0, accidental: 0 }, "G")).toBe(55);
    expect(pitchMidi({ degree: 3, octave: 0, accidental: 0 }, "D")).toBe(54);
  });

  it("reads chords", () => {
    const { score } = body("[1 3 5]/ [2]");
    expect(score.events[0]).toMatchObject({ kind: "chord", halvings: 1 });
    expect(score.events[0].pitches).toHaveLength(3);
    expect(score.events[1].kind).toBe("note");
  });

  it("ignores bar lines and reports junk without throwing", () => {
    expect(body("1 | 2 || 3").score.events).toHaveLength(3);
    const { score, errors } = body("1 x 2 - - ");
    expect(score.events).toHaveLength(2);
    expect(errors[0].message).toContain("x");
  });

  it("reports notes outside the keyboard", () => {
    expect(body("1''''").errors.length).toBe(1);
  });

  it("reads a body with no header", () => {
    expect(parseScore("1 2 3").score.events).toHaveLength(3);
  });
});

describe("serializeScore", () => {
  it("round-trips", () => {
    for (const { text } of BUILTIN_SCORES) {
      const first = parseScore(text).score;
      const again = parseScore(serializeScore(first)).score;
      expect(again).toEqual(first);
    }
    const tricky = body("[1 3 5]./ #4'' b2, 0// -", "title: x\n").score;
    expect(parseScore(serializeScore(tricky)).score).toEqual(tricky);
  });
});

describe("built-in scores", () => {
  it("parse cleanly and fill whole bars", () => {
    for (const { text } of BUILTIN_SCORES) {
      const { score, errors } = parseScore(text);
      expect(errors).toEqual([]);
      expect((scoreBeats(score) - score.pickup) % barBeats(score.time)).toBe(0);
    }
  });
});

describe("layoutBars", () => {
  it("bars by the time signature", () => {
    const bars = layoutBars(body("1 2 3 4 5 - - - 1", "time: 4/4\n").score);
    expect(bars).toHaveLength(3);
    expect(bars[1].groups.flat().map((g) => g.type)).toEqual(["note", "dash", "dash", "dash"]);
  });

  it("honours the pickup", () => {
    const bars = layoutBars(body("5 1 2 3", "time: 3/4\npickup: 1\n").score);
    expect(bars.map((b) => b.groups.flat().length)).toEqual([1, 3]);
  });

  it("joins underlines of notes within one beat", () => {
    const bars = layoutBars(body("1/ 2/ 3 5./ 6// 1// 2// 3/", "time: 4/4\n").score);
    expect(bars[0].groups.map((g) => g.length)).toEqual([2, 1, 2, 3]);
  });

  it("splits dashes across a bar line", () => {
    const bars = layoutBars(body("1 2 3 4 - - -", "time: 3/4\n").score);
    expect(bars.map((b) => b.groups.flat().map((g) => g.type).join())).toEqual([
      "note,note,note",
      "note,dash,dash",
      "dash",
    ]);
  });
});

describe("layoutJianpu", () => {
  it("packs bars into lines by width and lines into pages", () => {
    const twinkle = parseScore(BUILTIN_SCORES[0].text).score;
    // Each 4/4 bar here is 4 glyphs + 1 for the bar line: 30 slots fit 6 bars.
    const wide = layoutJianpu(twinkle, { slotsPerLine: 30, linesPerPage: 4 });
    expect(wide.pages.map((p) => p.map((l) => l.bars.length))).toEqual([[6, 6]]);
    const layout = layoutJianpu(twinkle, { slotsPerLine: 20, linesPerPage: 2 });
    expect(layout.pages.map((p) => p.length)).toEqual([2, 1]);
    expect(pageOfEvent(layout, 0)).toBe(0);
    expect(pageOfEvent(layout, twinkle.events.length - 1)).toBe(1);
  });

  it("balances lines instead of leaving a lone bar", () => {
    const birthday = parseScore(BUILTIN_SCORES[1].text).score;
    const layout = layoutJianpu(birthday, { slotsPerLine: 34, linesPerPage: 4 });
    expect(layout.pages[0].map((l) => l.bars.length)).toEqual([5, 4]);
  });

  it("always puts a too-wide bar on a line of its own", () => {
    const layout = layoutJianpu(body("1 2 3 4 5 6 7 1").score, { slotsPerLine: 3, linesPerPage: 1 });
    expect(layout.pages.map((p) => p[0].bars.length)).toEqual([1, 1]);
  });

  it("has one empty page for an empty score", () => {
    expect(layoutJianpu(body("").score, { slotsPerLine: 30, linesPerPage: 3 }).pages).toEqual([[]]);
  });
});

describe("keyHint", () => {
  it("prefers no octave key", () => {
    expect(keyHint(48)).toEqual({ code: "KeyZ", shift: 0 });
    expect(keyHint(64)).toEqual({ code: "Slash", shift: 0 });
  });

  it("uses an octave key when needed", () => {
    expect(keyHint(67)).toEqual({ code: "KeyB", shift: 1 });
    expect(keyHint(40)).toEqual({ code: "KeyC", shift: -1 });
    expect(keyHint(24)).toEqual({ code: "KeyZ", shift: -2 });
  });

  it("returns null outside the keyboard", () => {
    expect(keyHint(23)).toBeNull();
    expect(keyHint(89)).toBeNull();
  });
});
