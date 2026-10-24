import { describe, expect, it } from "vitest";
import { BUILTIN_SCORES } from "./builtin-scores";
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

  it("reads lyrics after a second --- line", () => {
    const { score, errors } = parseScore("title: x\n---\n1 2 3 -\n---\n一二三\n四");
    expect(errors).toEqual([]);
    expect(score.events).toHaveLength(3);
    expect(score.lyrics).toBe("一二三\n四");
  });

  it("has no lyrics without a second --- line", () => {
    expect(parseScore("title: x\n---\n1 2 3").score.lyrics).toBe("");
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

  it("writes lyrics after a second --- line, and nothing when there are none", () => {
    const withLyrics = { ...body("1 2", "title: x\n").score, lyrics: "hap-py --" };
    const text = serializeScore(withLyrics);
    expect(text.endsWith("---\nhap-py --\n")).toBe(true);
    expect(parseScore(text).score).toEqual(withLyrics);
    expect(serializeScore(body("1 2", "title: x\n").score).match(/---/g)).toHaveLength(1);
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
