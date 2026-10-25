import { describe, expect, it } from "vitest";
import { BUILTIN_SCORES } from "./builtin-scores";
import { MIN_BEAT, fitBeats, groupLeads, keyHint, layoutBars, layoutLines, layoutPages, lyricFont, pageOfEvent, placeLine, placeLyrics, sameSheetBox, sheetMetrics } from "./jianpu-layout";
import { alignLyrics, lyricSlots, parseLyrics, slotKey } from "./lyrics";
import { parseScore } from "./score";

const body = (notes: string, header = "") => parseScore(`${header}---\n${notes}`).score;
const birthday = parseScore(BUILTIN_SCORES[1].text).score;

describe("layoutBars", () => {
  it("bars by the time signature", () => {
    const bars = layoutBars(body("1 2 3 4 5 - - - 1", "time: 4/4\n"));
    expect(bars).toHaveLength(3);
    expect(bars[1].groups.flat().map((g) => g.type)).toEqual(["note", "dash", "dash", "dash"]);
  });

  it("draws the pickup as a whole bar, its missing beats filled with rests that belong to no event", () => {
    const bars = layoutBars(body("5 1 2 3", "time: 3/4\npickup: 1\n"));
    expect(bars[0].groups.flat().map((g) => [g.type, g.event, g.start, g.slot])).toEqual([
      ["rest", -1, 0, null],
      ["rest", -1, 1, null],
      ["note", 0, 2, { event: 0, ext: 0 }],
    ]);
    expect(bars[1].groups.flat().map((g) => g.event)).toEqual([1, 2, 3]);
  });

  it("fills a pickup that starts mid-beat with a shorter rest, beamed with the pickup's first note", () => {
    const bars = layoutBars(body("5/ 1 2 3 4", "time: 4/4\npickup: 0.5\n"));
    expect(bars[0].groups.map((group) => group.map((g) => [g.type, g.start, g.span, g.underlines]))).toEqual([
      [["rest", 0, 1, 0]],
      [["rest", 1, 1, 0]],
      [["rest", 2, 1, 0]],
      [
        ["rest", 3, 0.5, 1],
        ["note", 3.5, 0.5, 1],
      ],
    ]);
  });

  it("adds no rests to a pickup as long as a bar, nor to an empty score", () => {
    expect(layoutBars(body("1 2 3", "time: 3/4\npickup: 3\n"))[0].groups.flat().map((g) => g.event)).toEqual([0, 1, 2]);
    expect(layoutBars(body("", "time: 3/4\npickup: 1\n"))).toEqual([]);
  });

  it("joins underlines of notes within one beat", () => {
    const bars = layoutBars(body("1/ 2/ 3 5./ 6// 1// 2// 3/", "time: 4/4\n"));
    expect(bars[0].groups.map((g) => g.length)).toEqual([2, 1, 2, 3]);
  });

  it("splits dashes across a bar line", () => {
    const bars = layoutBars(body("1 2 3 4 - - -", "time: 3/4\n"));
    expect(bars.map((b) => b.groups.flat().map((g) => g.type).join())).toEqual([
      "note,note,note",
      "note,dash,dash",
      "dash",
    ]);
  });

  it("times glyphs in beats from the start of their bar", () => {
    const glyphs = layoutBars(body("5./ 5// 6 7 1 | 1 - 2/ 3/ 4", "time: 4/4\n")).map((b) => b.groups.flat());
    expect(glyphs[0].map((g) => [g.start, g.span])).toEqual([
      [0, 0.75],
      [0.75, 0.25],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(glyphs[1].map((g) => [g.start, g.span])).toEqual([
      [0, 1],
      [1, 1],
      [2, 0.5],
      [2.5, 0.5],
      [3, 1],
    ]);
  });

  it("caps a note longer than a beat at one beat", () => {
    const glyph = layoutBars(body("5. 6/", "time: 2/4\n"))[0].groups.flat();
    expect(glyph.map((g) => [g.start, g.span])).toEqual([
      [0, 1],
      [1.5, 0.5],
    ]);
  });

  it("gives notes and the dashes that hold them a lyric slot, but not rests", () => {
    const glyphs = layoutBars(body("1 - 0 - [1 3]", "time: 4/4\n")).flatMap((b) => b.groups.flat());
    expect(glyphs.map((g) => g.slot)).toEqual([{ event: 0, ext: 0 }, { event: 0, ext: 1 }, null, null, { event: 2, ext: 0 }]);
  });

  it("sizes every bar by the time signature, the pickup bar too", () => {
    const bars = layoutBars(body("5 1 2 3 4", "time: 3/4\npickup: 1\n"));
    expect(bars.map((b) => b.beats)).toEqual([3, 3, 3]);
  });
});

describe("layoutLines", () => {
  it("puts whole bars on lines of N beats", () => {
    const twelve = body("1 2 3 4 ".repeat(12), "time: 4/4\n");
    expect(layoutLines(twelve, 16).map((l) => l.bars.length)).toEqual([4, 4, 4]);
    const ten = body("1 2 3 ".repeat(10), "time: 3/4\n");
    expect(layoutLines(ten, 16).map((l) => l.bars.length)).toEqual([5, 5]);
  });

  it("lines up the bars of the pickup's line with the lines below", () => {
    const lines = layoutLines(birthday, 16);
    expect(lines.map((l) => l.bars.length)).toEqual([5, 4]);
    const m = sheetMetrics(900, 16, 3);
    const [first, second] = lines.map((l) => placeLine(l, m).bars.map((b) => b.x));
    expect(first.slice(0, second.length)).toEqual(second);
  });

  it("gives a bar wider than the line a line of its own", () => {
    expect(layoutLines(body("1 2 3 4 5 6 7 1"), 3).map((l) => l.bars.length)).toEqual([1, 1]);
  });
});

describe("layoutPages", () => {
  it("splits lines into pages and finds an event's page", () => {
    const score = body("1 2 3 4 ".repeat(12), "time: 4/4\n");
    const pages = layoutPages(layoutLines(score, 8), 2);
    expect(pages.map((p) => p.length)).toEqual([2, 2, 2]);
    expect(pageOfEvent(pages, 0)).toBe(0);
    expect(pageOfEvent(pages, score.events.length - 1)).toBe(2);
  });

  it("has one empty page for an empty score", () => {
    expect(layoutPages(layoutLines(body(""), 16), 3)).toEqual([[]]);
  });
});

describe("sheetMetrics", () => {
  it("fits N beats and the bar gaps into the width", () => {
    // 4/4 at N=16: 4 bars, so room for 5 gaps of 0.4 beat: 900 / 18 = 50.
    expect(sheetMetrics(900, 16, 4)).toEqual({ beat: 50, gap: 20, font: 18 });
  });

  it("keeps digits between 11 and 24 px", () => {
    expect(sheetMetrics(300, 16, 4).font).toBe(11);
    expect(sheetMetrics(4000, 16, 4).font).toBe(24);
  });
});

describe("sameSheetBox", () => {
  it("ignores width changes under 2 px, so measuring a sheet whose padding follows its font settles", () => {
    const prev = { width: 860, linesPerPage: 3 };
    expect(sameSheetBox(prev, { width: 860.4, linesPerPage: 3 })).toBe(prev);
    expect(sameSheetBox(prev, { width: 858.5, linesPerPage: 3 })).toBe(prev);
  });

  it("takes a real change of width or lines", () => {
    const prev = { width: 860, linesPerPage: 3 };
    expect(sameSheetBox(prev, { width: 840, linesPerPage: 3 })).toEqual({ width: 840, linesPerPage: 3 });
    expect(sameSheetBox(prev, { width: 860, linesPerPage: 2 })).toEqual({ width: 860, linesPerPage: 2 });
  });
});

describe("placeLine", () => {
  it("places glyph boxes by beat and bars after a gap", () => {
    const [line] = layoutLines(body("1 2 3 4 5 6 7 1", "time: 4/4\n"), 16);
    const placed = placeLine(line, { beat: 50, gap: 20, font: 18 });
    expect(placed.glyphs[0]).toMatchObject({ x: 0, width: 50 });
    expect(placed.glyphs[0].x + placed.glyphs[0].width / 2).toBe((0 + 0.5) * 50);
    expect(placed.glyphs[4].x).toBe(4 * 50 + 1 * 20);
    expect(placed.bars.map((b) => b.x)).toEqual([0, 220]);
    expect(placed.width).toBe(440);
  });

  it("draws the last bar of a score at its full length", () => {
    const [line] = layoutLines(body("1 2", "time: 4/4\n"), 16);
    expect(placeLine(line, { beat: 50, gap: 20, font: 18 }).bars[0].width).toBe(200);
  });
});

describe("placeLyrics", () => {
  const m = { beat: 50, gap: 20, font: 18 };
  /** Place the first line of `notes` with `lyrics`, lyrics font 12 px. */
  const place = (notes: string, lyrics: string) => {
    const score = body(notes, "time: 4/4\n");
    const { bySlot } = alignLyrics(lyricSlots(score), parseLyrics(lyrics));
    const items = new Map(lyricSlots(score).map((slot, i) => [slotKey(slot), bySlot[i]]));
    return placeLyrics(placeLine(layoutLines(score, 16)[0], m), (slot) => items.get(slotKey(slot)) ?? null, 12);
  };

  it("centres each word under its note", () => {
    const placed = place("1 2 0 3", "一 二 三");
    expect(placed.words.map((w) => [w.text, w.x])).toEqual([
      ["一", 25],
      ["二", 75],
      ["三", 175],
    ]);
    expect(placed.words.every((w) => w.scale === 1)).toBe(true);
  });

  it("draws nothing for a note that is not sung", () => {
    expect(place("1 2", "0 二").words.map((w) => w.text)).toEqual(["二"]);
  });

  it("shrinks a word that is wider than the room between its neighbours", () => {
    const placed = place("1// 2// 3// 4// 5", "wonderfully a b c d");
    expect(placed.words[0].scale).toBeLessThan(1);
    expect(placed.words[0].scale).toBeGreaterThanOrEqual(0.6);
    expect(placed.words[4].scale).toBe(1);
  });

  it("ties the parts of a split word with one bracket", () => {
    const placed = place("1 2 3", "hap-py day");
    expect(placed.brackets).toHaveLength(1);
    const [bracket] = placed.brackets;
    expect(bracket.x1).toBeLessThan(25);
    expect(bracket.x2).toBeGreaterThan(75);
    expect(bracket.x2).toBeLessThan(125);
  });

  it("runs a hold line from the end of the word to the end of the last held beat", () => {
    const placed = place("1 - - 2", "乐-- 二");
    expect(placed.holds).toHaveLength(1);
    expect(placed.holds[0].x1).toBeGreaterThan(25 + 6);
    expect(placed.holds[0].x1).toBeLessThan(40);
    expect(placed.holds[0].x2).toBeGreaterThan(140);
    expect(placed.holds[0].x2).toBeLessThanOrEqual(150);
  });

  it("centres a word without its punctuation, which hangs after it", () => {
    const placed = place("1 - 2", "乐，- 二");
    expect(placed.words[0]).toMatchObject({ text: "乐", tail: "，", x: 25 });
    // The hold line starts after the comma: 25 + half of 乐 (6) + the comma (12).
    expect(placed.holds[0].x1).toBeGreaterThan(25 + 6 + 12);
  });

  it("centres a word without an opening bracket, which hangs before it", () => {
    const placed = place("1 2", "(一 二)");
    expect(placed.words.map((w) => [w.head, w.text, w.tail, w.x])).toEqual([
      ["(", "一", "", 25],
      ["", "二", ")", 75],
    ]);
  });

  it("marks a word that falls on a dash", () => {
    expect(place("1 - 2", "一 二 三").words.map((w) => w.misplaced)).toEqual([false, true, false]);
  });
});

describe("fitBeats", () => {
  it("keeps N beats while digits stay at 11 px or more", () => {
    expect(fitBeats(900, 16, 4)).toBe(16);
  });

  it("puts fewer beats on a line too narrow for N with readable digits", () => {
    // 600 px at N = 32 in 4/4: about 17 px a beat, too narrow for 11 px digits.
    const n = fitBeats(600, 32, 4);
    expect(n).toBeLessThan(32);
    expect(sheetMetrics(600, n, 4).beat).toBeGreaterThanOrEqual(MIN_BEAT);
    expect(sheetMetrics(600, n + 1, 4).beat).toBeLessThan(MIN_BEAT);
  });

  it("keeps N before the sheet is measured", () => {
    expect(fitBeats(0, 16, 4)).toBe(16);
  });
});

describe("groupLeads", () => {
  it("puts each glyph drawn in flow where placeLine says, so notes and lyrics line up", () => {
    const m = sheetMetrics(900, 16, 4);
    const scores = [...BUILTIN_SCORES.map((b) => parseScore(b.text).score), body("0/ 5// 6// 1 - 2. 3/ | 1/ 0/ 0 5", "time: 4/4\npickup: 1.5\n")];
    for (const score of scores) {
      for (const line of layoutLines(score, 16)) {
        const placed = placeLine(line, m);
        const flow: number[] = [];
        line.bars.forEach((bar, bi) => {
          let x = placed.bars[bi].x;
          const leads = groupLeads(bar, m.beat);
          bar.groups.forEach((group, gi) => {
            x += leads[gi];
            for (const glyph of group) {
              flow.push(x);
              x += glyph.span * m.beat;
            }
          });
        });
        expect(flow.length).toBe(placed.glyphs.length);
        flow.forEach((x, i) => expect(x).toBeCloseTo(placed.glyphs[i].x, 6));
      }
    }
  });
});

describe("lyricFont", () => {
  it("is three quarters of the digit size, but never under 11 px", () => {
    expect(lyricFont(20)).toBe(15);
    expect(lyricFont(11)).toBe(11);
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
